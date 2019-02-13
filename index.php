<html>
	<head>
		
		<title>SportSim</title>
		
		<script src="./lib/jquery-3.3.1/jquery.min.js"></script>
		<script src="./lib/underscore-1.9.1/underscore.min.js"></script>
		<script src="./lib/physicsjs-0.7.0/physicsjs.min.js"></script>
		
	<!-- game models -->
		
		<script src="./src/js/models/attribute.js"></script>
		<script src="./src/js/models/structure.js"></script>
		
		<script src="./src/js/models/_liverecord.js"></script>
		
		<script src="./src/js/models/entity.js"></script>
		<script src="./src/js/models/entity/human.js"></script>
		
		<script src="./src/js/models/possession.js"></script>
		<script src="./src/js/models/possession/consumable.js"></script>
		
		<script src="./src/js/models/location.js"></script>
		<script src="./src/js/models/location/bar.js"></script>
		<script src="./src/js/models/location/busstop.js"></script>
		<script src="./src/js/models/location/cafe.js"></script>
		<script src="./src/js/models/location/court.js"></script>
		<script src="./src/js/models/location/grocery.js"></script>
		<script src="./src/js/models/location/jail.js"></script>
		<script src="./src/js/models/location/mart.js"></script>
		<script src="./src/js/models/location/university.js"></script>
		
		<script src="./src/js/models/artwork.js"></script>
		<script src="./src/js/models/artwork/painting.js"></script>
		<script src="./src/js/models/artwork/sculpture.js"></script>
		<script src="./src/js/models/artwork/performance.js"></script>
		<script src="./src/js/models/artwork/chapbook.js"></script>
		<script src="./src/js/models/artwork/poem.js"></script>
		
		<script src="./src/js/sim.js"></script>
		
	</head>
	<body>
		
		<header id="header">
			<nav id="main-menu" class="menu-wrap">
				<ul class="menu">
					<li class="menu-item"><a>Game</a></li>
					<li class="menu-item"><a>Career</a></li>
					<li class="menu-item"><a>Health</a></li>
					<li class="menu-item"><a>Finance</a></li>
				</ul>
			</nav>
		</header>
		
		<aside id="sidebar">
			<nav id="context-menu">
				<ul class="menu">
					<li class="menu-item">No menu items</li>
				</ul>
			</nav>
		</aside>
		
		<main id="sim">
			<!-- the simulation takes place here -->
		</main>
		
		<footer id="status">
			<ul class="inline">
				<li class="time"><time datetime="2001-01-14 20:00">8:00 pm on Jan. 14, 2001</time></li>
				<li class="balance"><var class="usd">0.00</var></li>
				<li class="mood">fine</li>
				<li class="hunger">starving</li>
				<li class="emails"><var>4</var></li>
			</ul>
		</footer>
		
	</body>
</html>
