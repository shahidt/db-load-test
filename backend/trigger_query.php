<?php
/*
	Original code by Shahid Thaika - shahidt@gmail.com.
	Executes the actual query called by the front end
*/

	//verify if query is mentioned
	if ( !(is_array($_POST)
				&& array_key_exists('dsn', $_POST)
				&& array_key_exists('username', $_POST)
				&& array_key_exists('password', $_POST)
				&& array_key_exists('title', $_POST)
				&& array_key_exists('query', $_POST)
			) )
		die(
			json_encode(
				[
					'status' => 'nodata',
					'message' => 'Not all config inputs defined!',
				]
			)
		);

	try {		
		//trigger query using PDO
		$pdo = new \PDO( $_POST['dsn'], $_POST['username'], $_POST['password'], [ \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION ] );

		$stmt = $pdo->prepare($_POST['query']);
		$start_time = time();
		$stmt->execute();
		$rows = $stmt->rowCount();

		//return success and execution metrics
		die(
			json_encode(
				[
					'status' => 'success',
					'title' => $_POST['title'],
					'duration' => time() - $start_time,
					'rows' => $rows,
				]
			)
		);
	} catch (\PDOException $e) {
		//return error
		die(
			json_encode(
				[
					'status' => 'error',
					'title' => $_POST['title'],
					'message' => $e->getMessage(),
				]
			)
		);
	}