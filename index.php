<html>
	<head>
		<title>SportSim</title>
		<link href="./dist/sim.min.css" rel="stylesheet" type="text/css"></link>
	</head>
	<body>
		<div id="app">
			<div class="app-wrap">
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
					<router-view>
						<!-- the simulation takes place here -->
					</router-view>
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
			</div>
		</div>
		<script src="./dist/sim.min.js" defer></script>
	</body>
</html>
