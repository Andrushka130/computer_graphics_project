function createShader(gl, type, source) {
	let shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (success) {
		return shader;
	}

	switch (type) {
		case gl.VERTEX_SHADER:
			console.error("VERTEX SHADER " + gl.getShaderInfoLog(shader));
			break;
		case gl.FRAGMENT_SHADER:
			console.error("FRAGMENT SHADER " + gl.getShaderInfoLog(shader));
			break;
		default:
			console.error(gl.getShaderInfoLog(shader));
			break;
	}
	gl.deleteShader(shader);
	return undefined;
}

function createProgram(gl, vertexShader, fragmentShader) {
	let program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	const success = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (success) {
		return program;
	}

	console.error(gl.getProgramInfoLog(program));
	gl.deleteProgram(program);
	return undefined;
}

function loadTextResource(url) {
	return new Promise(function (resolve, reject) {
		let request = new XMLHttpRequest();
		// add a query string with random content, otherwise the browser may cache the file and not reload properly
		request.open("GET", url + "?please-dont-cache=" + Math.random(), true);
		request.onload = function () {
			if (request.status === 200) {
				resolve(request.responseText);
			}
			else {
				reject("Error: HTTP Status " + request.status + " on resource " + url);
			}
		}
		request.send();
	});
}

function hslToRgb(h, s, l) {
	h /= 360;
	const a = s * Math.min(l, 1 - l);
	const f = (n, k = (n + h / (1/12)) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
	return [f(0), f(8), f(4)];
}

function easeInOutQuad(t) {
	return t < 0.5
		? 2 * t * t
		: -1 + (4 - 2 * t) * t;
}

function shortestAngleBetween(a, b) {
	let diff = b - a;

	//another edgecase -> when multiple 360° happened
	diff %= (Math.PI * 2);
	//shoutouts => https://stackoverflow.com/questions/1878907/how-can-i-find-the-smallest-difference-between-two-angles-around-a-point
	//if rotation greater than 180 sub 360 - if smaller than -180 add 360 
	diff += (diff > Math.PI) ? -(Math.PI * 2) : (diff < -(Math.PI)) ? (Math.PI * 2) : 0
	return diff;
}