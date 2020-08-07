/*
	Original code by Shahid Thaika - shahidt@gmail.com.
*/

const TRIGGER_QUERY_URL = "/backend/trigger_query.php";

var queryItems = [];
var interval_pos = 0;
var queriesTriggered = 0;

//load/save previous config to session
var dsn = '';
var config = JSON.parse( (sessionStorage.getItem('config') || '{}') );
if (config.hasOwnProperty('queryList')) {
	document.getElementById('dbms').value = config['dbms'];
	document.getElementById('server').value = config['server'];
	document.getElementById('port').value = config['port'];
	document.getElementById('database').value = config['database'];
	document.getElementById('username').value = config['username'];
	document.getElementById('queryList').value = config['queryList'];
}

//execute the load test queries
document.getElementById('doTest').onclick = function() {
	if (this.innerText == "Execute") {
		//check for inputs and store
		if (!(
			document.getElementById('dbms').value.length > 0 &&
			document.getElementById('server').value.length > 0 &&
			document.getElementById('database').value.length > 0 &&
			document.getElementById('username').value.length > 0 &&
			document.getElementById('queryList').value.length > 0
		)) {
			appendResult("Not all config inputs specified");
			return;
		}
		
		
		document.getElementById('exec_status').innerHTML = "Executing query list...";
		this.innerText = "Cancel";
		
		config = {
					'dbms': document.getElementById('dbms').value,
					'server': document.getElementById('server').value,
					'port': document.getElementById('port').value,
					'database': document.getElementById('database').value,
					'username': document.getElementById('username').value,
					'password': document.getElementById('password').value,
					'queryList': document.getElementById('queryList').value
				};
		sessionStorage.setItem('config', JSON.stringify(config));
		
		switch (config['dbms']) {
			case 'mysql':
				dsn = 'mysql:host=' + config['server'] + (config['port'].length > 0 ? ';port=' + config['port'] : '') + ';dbname=' + config['database'] + ';charset=utf8';
				break;
				
			case 'sqlsrv':
				dsn = 'sqlsrv:Server=' + config['server'] + (config['port'].length > 0 ? ',' + config['port'] : '') + ';Database=' + config['database'];
				break;
		}
		
		interval_pos = 0;
		queriesTriggered = 0;
		queryItems = [];

		//populate the list to execute
		//:@: is our true EOL delimiter
		var qi = document.getElementById('queryList').value.split(':@:');
		for (var i=0; i<qi.length; i++) {
			//@:@ is where the query begins
			var qi_part = qi[i].split('@:@');
			
			//get query meta which is TSV
			if (qi_part.length == 2) {
				qip_meta = qi_part[0].split('\t');
				
				//5 to accomodate the TAB at the end
				if (qip_meta.length == 5) {
					//populate the list
					queryItems.push(
						{
							'interval': parseInt(qip_meta[0].replace('\n', '')),
							'repeat': parseInt(qip_meta[1]),
							'repeat_gap': parseInt(qip_meta[2]),
							'title': qip_meta[3],
							'query': qi_part[1]
						}
					);
				}
			}
		}
		
		//call the function that will iterate and process the query list items
		if (queryItems.length > 0)
			setTimeout(iterate_query_list, 0);
	} else {
		this.innerText = "Execute";
		this.setAttribute('disabled', 'disabled');
	}
}

function iterate_query_list() {
	//do not iterate further if cancelled
	if (document.getElementById('doTest').innerText == "Execute") {
		queryItems = [];
		
		if (queriesTriggered == 0 && queryItems.length == 0) {
			appendResult("Received response from all queries.\n");
			document.getElementById('exec_status').innerHTML = "Done!";
			document.getElementById('doTest').removeAttribute('disabled');
		}
		
		return;
	}
	
	//check which queries can be run in the next second
	for (var i=0; i<queryItems.length; i++) {
		var qi = queryItems[i];
		if (qi['interval'] < (interval_pos + 1000)) {
			//trigger each repetition
			qi['repeat'] = qi['repeat'] == 0 ? 1 : qi['repeat'];
			for (var j=0; j<qi['repeat']; j++) {
				queriesTriggered++;

				setTimeout(
					function(qTitle, qQuery) {
						triggerQuery(qTitle, qQuery);
					},
					( (qi['interval'] - interval_pos) + (j * qi['repeat_gap']) ),
					qi['title'] + " (#" + (j+1) + ")", //qi['title'] + (j>0 ? "(#" + (j+1) + ")" : ""),
					qi['query']
				);
			}
			queryItems.splice(i, 1);
		}
	}
	
	//check for more items
	document.getElementById('exec_status').innerHTML = "Elapsed: " + interval_pos + " milliseconds...";
	if (queryItems.length > 0) {
		interval_pos += 1000;
		setTimeout(iterate_query_list, 1000);
	} else {
		setTimeout(
			function() {
				appendResult("Iterated through all items.");
			}, 500);
	}
}


function triggerQuery(title, query) {
	//trigger query using ajax
	var xhttp = new XMLHttpRequest();
	
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			try {
				//convert to json and check for status
				var data = JSON.parse(this.responseText);
				
				if (data.hasOwnProperty('status')) {
					switch (data['status']) {
						case 'nodata':
							appendResult("Not enough input data.");
							break;
							
						case 'error':
							appendResult(data['title'] + ": Error! " + data['message'] + ".");
							break;
							
						case 'success':
							appendResult(
								data['title'] + ": Success! " +
								data['rows'] + " row" + (data['rows'] == 1 ? "" : "s") + " affected in " + 
								data['duration'] + " second" + (data['duration'] == 1 ? "" : "s") + "."
							);
							break;
					}
				} else {
					//no status
					appendResult("Error: Not a valid response.");
				}
			} catch (e) {
				appendResult( "Error: " + e.message + ".");
			}
			
			queriesTriggered--;
			
			if (queriesTriggered == 0 && queryItems.length == 0) {
				setTimeout(
					function() {
						appendResult("Received response from all queries.\n");
						document.getElementById('exec_status').innerHTML = "Done!";
						
						var doT = document.getElementById('doTest');
						doT.innerText = "Execute";
						doT.removeAttribute('disabled');
					}, 500);
			}
		}
	};
	
	xhttp.open("POST", TRIGGER_QUERY_URL, true);
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	xhttp.send(
		"dsn=" + encodeURIComponent(dsn) +
		"&username=" + encodeURIComponent(config['username']) +
		"&password=" + encodeURIComponent(config['password']) +
		"&title=" + encodeURIComponent(title) +
		"&query=" + encodeURIComponent(query)
	);
}

function appendResult(result) {
	var orTextArea = document.getElementById('outputResult');
	var str = orTextArea.innerHTML + result + "\n";
	orTextArea.innerHTML = str;
}