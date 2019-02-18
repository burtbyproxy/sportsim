<?php

	use Medoo\Medoo;
	require_once './vendor/catfan/medoo/src/Medoo.php';
	
	$db = new Medoo([
		'database_type' => 'mysql',
		'database_name' => 'sportsim',
		'server' => 'localhost',
		'username' => 'root',
		'password' => ''
	]);
	
	$path = $_GET['path'];
	$params = explode("/", $path);
	
	$table = !empty($params[0]) ? $params[0] : null;
	$handle = !empty($params[1]) ? $params[1] : null;
	
	if($table) {
		if($handle) {
			$record = [
				"id" => "",
				"subclass" => "",
				"handle" => "",
				"description" => "",
				"settings" => "",
				"coordinates" => ""
			];
			$found = $db->get($table, ["id", "handle", "subclass", "description", "settings", "x", "y", "z"], ['handle' => $handle]);
			if(!empty($found)) {
				$record['id'] = $found['id'];
				$record['handle'] = $found['handle'];
				$record['subclass'] = $found['subclass'];
				$record['description'] = $found['description'];
				$record['settings'] = $found['settings'];
				$record['coordinates'] = $found['x'] .', '. $found['y']. ', ' .$found['z'];
			}
		}
		
		else {
			$records = $db->select($table, ["id", "handle", "display"]);
		}
	}

?>
<html>
	<head>
		<title>Ugly Backend</title>
		<style>
			
			html { font-family: sans-serif; font-size: 16px; line-height: 1.4; }
			
			.danger { color: red; }
			
			ul.inline { list-style: none; padding: 0; margin: 1rem 0; }
			ul.inline > li { float: left; margin: 0 0 0 .8rem; }
			ul.inline > li:first-of-type { margin-left: 0; }
			ul.inline > li > a { color: #66C; text-decoration: none; }
			ul.inline > li > a:hover, ul.inline > li > a:active, ul.inline > li > a:focus  { text-decoration: underline; }
			ul.inline > li.selected > a { color: inherit; }
			
			label>strong { display: block; font-size: .8rem; margin: 1.2rem 0 .4rem; }
			
			.field { font-family: monospace; font-size: 1rem; line-height: 1.6; padding: .4rem .8rem; border:1px solid #ddd; background:#ddd; }
			.field:focus, .field:active { outline: 0; background:#eee; }
			
			textarea.field { width: 90%; height: 12rem; padding: .8rem .8rem; resize: vertical; }
			
			.field.compact { width: 4rem; float: left; margin: 0 0 0 .4rem; }
			.field.compact:first-of-type { margin-left: 0; }
			
			.field[disabled] { background: #fff; color: #999; }
			
			.form-group {
				margin: 1rem 0;
			}
			
			ul.inline:after,
			.form-group:after {
				content: "";
				clear: both;
				display: block;
			}
			
			ul.records { color: #DDD; padding: 0; list-style: none; }
			ul.records li > strong { font-size: 1.4rem; display: block; margin: 0 0 .1rem; color: #000; }
			ul.records li { padding: .8rem 1.4rem; border-top: 1px solid #ddd; }
			
		</style>
	</head>
	<body>
		<h1>Ugly Backend</h1>
		<ul class="inline">
			<li value="artwork"<?php if($table === 'artwork') echo ' class="selected"'; ?>><a href="/console/artwork">Artwork</a></option>
			<li value="entities"<?php if($table === 'entities') echo ' class="selected"'; ?>><a href="/console/entities">Entities</a></option>
			<li value="locations"<?php if($table === 'locations') echo ' class="selected"'; ?>><a href="/console/locations">Locations</a></option>
			<li value="possessions"<?php if($table === 'possessions') echo ' class="selected"'; ?>><a href="/console/possessions">Possessions</a></option>
			<li value="structures"<?php if($table === 'structures') echo ' class="selected"'; ?>><a href="/console/structures">Structures</a></option>
		</ul>
		
		
	<?php if(!empty($record)) { ?>
		
		<form method="post" action="console.php">
			<fieldset>
				
				<div class="form-group">
					<label for="subclass">
						<strong>Subclass</strong>
						<input class="field" type="text" name="subclass" value="<?= $record['subclass'] ?>">
					</label>
				</div>
				
				<div class="form-group">
					<label for="handle">
						<strong>Handle</strong>
						<input class="field" type="text" name="handle" value="<?= $record['handle'] ?>">
					</label>
				</div>
				
				<div class="form-group">
					<label for="description">
						<strong>Description</strong>
						<textarea class="field" name="description"><?= $record['description'] ?></textarea>
					</label>
				</div>
				
				<div class="form-group">
					<label for="settings">
						<strong>Settings (JSON)</strong>
						<textarea class="field" name="settings"><?= $record['settings'] ?></textarea>
					</label>
				</div>
				
				<div class="form-group">
					<label for="coordinates">
						<strong>Coordinates (x, y, z)</strong>
						<input class="field" type="text" name="coordinates" value="<?= $record['coordinates'] ?>">
					</label>
				</div>
				
				<div class="form-group controls">
					<input type="hidden" name="id" value="<?= $record["id"] ?>">
					<input type="hidden" name="table" value="<?= $table ?>">
					<button type="button" onclick="window.location.href = '/console/<?= $table ?>';">Back</button>
					<button type="submit">Save</button>
				</div>
				
			</fieldset>
		</form>
		
		
	<?php } else { ?>
		
		<ul class="records">
		<?php if(count($records) <= 0) { ?>
			<li class="record empty">There are no records of that type.</li>
		<?php } else { ?>
			<?php foreach($records as $idx => $record) { ?>
				<li class="record">
					<strong><?= $record['display'] ?></strong>
					<a href="/console/<?= $table ?>/<?= $record['handle'] ?>">edit</a>
					 | <a class="danger" href="/console/<?= $table ?>/<?= $record['handle'] ?>/delete">delete</a>
				</li>
			<?php } ?>
		<?php } ?>
		</ul>
		
	<?php } ?>
		
		
	</body>
</html>