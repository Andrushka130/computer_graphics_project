async function main() {
	await initialize();

	requestAnimationFrame(render);
}

//Constants 
const NUM_ITEMS = 10;
const ITEM_RADIUS = 8;
const KEYS = ["w", "s", "a", "d", "q", "e"];
const LERP_SPEED_INVENTORY = 0.025;


// this data is set in initialize() and used in render()
let gl;
let program;
let vao;
let uniformModelMatrixLocation;
let uniformViewMatrixLocation;
let uniformProjectionMatrixLocation;

let cameraRotation = { x: 17.5, y: 0 };
let cameraTranslation = {x: 0, y: 1, z: 17.5}; //z = camera Distance

const items = [];
let selectedItemIndex = 0;

// switch between items
let startAngle = 0;
let targetAngle = 0;
let currentAngle = 0;
let rotationProgress = 1;

let inspectRotationX = 0;
let inspectRotationY = 0;

//input "manager" for simultaneously button presses
const keysPressed = new Set();

async function initialize() {
	const canvas = document.querySelector("canvas"); // get the html canvas element
	const canvasWrapper = document.querySelector("#canvasWrapper")
	
	// everytime we talk to WebGL we use this object
	gl = canvas.getContext("webgl2", { alpha: false });

	if (!gl) { 
		console.error("Your browser does not support WebGL2");
		return; 
	}

	for (let i = 0; i < NUM_ITEMS; i++)
	{
		// calculate angle in radiant for every object => Bsp: 1/8 * 2 * PI = 0.785
		const angle = (i / NUM_ITEMS) * 2 * Math.PI;
		const x = Math.sin(angle) * ITEM_RADIUS;
		const z = Math.cos(angle) * ITEM_RADIUS;


		const hue = (i/NUM_ITEMS) * 360;
		const color = hslToRgb(hue, 0.8, 0.6);

		items.push({
			position: {x, y: 0, z},
			angle,
			color: color,
			id: i
		});
	}

	// set the resolution of the html canvas element
	canvas.width = canvasWrapper.clientWidth;
	canvas.height = canvasWrapper.clientHeight;
	
	// set the resolution of the framebuffer
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	
	gl.enable(gl.DEPTH_TEST); // enable z-buffering
	gl.disable(gl.CULL_FACE); // enable back-face culling

	// loadTextResource returns a string that contains the content of a text file
	const vertexShaderText = await loadTextResource("shader.vert");
	const fragmentShaderText = await loadTextResource("shader.frag");
	// compile GLSL shaders - turn shader code into machine code that the GPU understands
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderText);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderText);
	// link the two shaders - create a program that uses both shaders
	program = createProgram(gl, vertexShader, fragmentShader);

	uploadAttributeData();

	uniformModelMatrixLocation = gl.getUniformLocation(program, "u_modelMatrix");
	uniformViewMatrixLocation = gl.getUniformLocation(program, "u_viewMatrix");
	uniformProjectionMatrixLocation = gl.getUniformLocation(program, "u_projectionMatrix");
	uniformColorLocation = gl.getUniformLocation(program, "u_color");
}

function uploadAttributeData() {
	vao = gl.createVertexArray();
	gl.bindVertexArray(vao);

	const indexBuffer = gl.createBuffer();
	// gl.ELEMENT_ARRAY_BUFFER tells WebGL that this buffer should be treated as an index list
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(quadMesh.indices), gl.STATIC_DRAW);

	const posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadMesh.positions), gl.STATIC_DRAW);
	const posAttributeLocation = gl.getAttribLocation(program, "a_position");
	gl.vertexAttribPointer(posAttributeLocation, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(posAttributeLocation);

	const uvBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadMesh.uvs), gl.STATIC_DRAW);
	const uvAttributeLocation = gl.getAttribLocation(program, "a_uv");
	gl.vertexAttribPointer(uvAttributeLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(uvAttributeLocation);

	// unbind to avoid accidental modification
	gl.bindVertexArray(null); // before other unbinds
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function render(time) {
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.clear(gl.DEPTH_BUFFER_BIT);

	gl.useProgram(program);

	gl.bindVertexArray(vao);

	updateRotation();

	//smooth rotation when switching between items
	if(rotationProgress < 1)
	{
		rotationProgress += LERP_SPEED_INVENTORY;

		if (rotationProgress > 1) rotationProgress = 1;

		const shortestAngle = shortestAngleBetween(startAngle, targetAngle);
		const t = easeInOutQuad(rotationProgress);
		currentAngle = startAngle + shortestAngle * t;
	}
	else{
		currentAngle = targetAngle;
	}

	const { viewMatrix, currentCameraPos } = setMatrices();
	const numVertices = quadMesh.indices.length;

	for(let i = 0; i < items.length; i++)
	{
		const item = items[i];

		const itemPos = item.position;

		const toCameraX = currentCameraPos.x - itemPos.x;
		const toCameraY = currentCameraPos.y - itemPos.y;
		const toCameraZ = currentCameraPos.z - itemPos.z;

		const lookAtAngleY = Math.atan2(toCameraX, toCameraZ);

		let modelMatrix = mat4Translation(itemPos.x, itemPos.y, itemPos.z);
		
		const rotationMatrix = mat4RotY(lookAtAngleY);
		modelMatrix = mat4Mul(modelMatrix, rotationMatrix); 
		
		if(i === selectedItemIndex)
		{
			const scaleMatrix = mat4Scale(1.4,1.4,1.4);
			modelMatrix = mat4Mul(modelMatrix, scaleMatrix);
		}
		gl.uniformMatrix4fv(uniformModelMatrixLocation, true, modelMatrix);
		gl.uniform3fv(uniformColorLocation, item.color);
		gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_SHORT, 0);
	}

	// unbind to avoid accidental modification
	gl.bindVertexArray(vao);
	gl.useProgram(null);

	requestAnimationFrame(render);
}

function setMatrices() {
	// use row-major notation (like in maths)
	const modelMatrix = [
		1,0,0,0,
		0,1,0,0,
		0,0,1,0,
		0,0,0,1,
	];
	
	const  targetRotationY = -(currentAngle * 180 / Math.PI) + cameraRotation.y; //grad
	
	const cameraWorldPos = getCameraWorldPosition(cameraRotation.x, -targetRotationY, cameraTranslation.z);

	const vT = mat4Translation(cameraTranslation.x, cameraTranslation.y, -cameraTranslation.z);

	const vRy = mat4RotY(targetRotationY * Math.PI / 180);
	const vRx = mat4RotX(cameraRotation.x * Math.PI / 180);

	const viewMatrix = mat4Mul(vT, mat4Mul(vRx, vRy));

	const canvasWrapper = document.querySelector("#canvasWrapper");
	const aspectRatio = canvasWrapper.clientWidth / canvasWrapper.clientHeight;
	const projectionMatrix = perspective(45, aspectRatio, 0.1, 100);

	// we set transpose to true to convert to column-major
	gl.uniformMatrix4fv(uniformModelMatrixLocation, true, modelMatrix);
	gl.uniformMatrix4fv(uniformViewMatrixLocation, true, viewMatrix);
	gl.uniformMatrix4fv(uniformProjectionMatrixLocation, true, projectionMatrix);

	return {viewMatrix, currentCameraPos: cameraWorldPos}
}

function rotateInventory(direction) {
	selectedItemIndex = (selectedItemIndex + direction + NUM_ITEMS) % NUM_ITEMS;

	startAngle = currentAngle;
	targetAngle = items[selectedItemIndex].angle;
	rotationProgress = 0;
}


function getCameraWorldPosition(rotXDeg, rotYDeg, distance, center = {x: 0, y: 0, z: 0}) {
	const rotX = rotXDeg * Math.PI / 180; //radiant
	const rotY = rotYDeg * Math.PI / 180; //radiant
	
	const sinY = Math.sin(rotY);
	const cosY = Math.cos(rotY);
	const sinX = Math.sin(rotX);
	const cosX = Math.cos(rotX);
	
	// https://de.wikipedia.org/wiki/Kugelkoordinaten => !different coordinate system z = y & x = z & y = x
	const dir = {
		x: sinY * cosX, 
		y: sinX,
		z: cosY * cosX
	};
	
	return {
		x: center.x + dir.x * distance,
		y: center.y + dir.y * distance,
		z: center.z + dir.z * distance
	};
}

//listerners
window.addEventListener("keydown", (event) => {
	const key = event.key.toLowerCase();
	
	// coolodown for button press
	if(rotationProgress >= 0.75)
	{
		if(key === "a") rotateInventory(-1);
		if(key === "d") rotateInventory(1);
	}
	
	if(KEYS.includes(key)) keysPressed.add(key);
});
window.addEventListener("keyup", (event) => {
	keysPressed.delete(event.key.toLowerCase());
});

function updateRotation() {
  if (keysPressed.has("w")) cameraRotation.x += 1.2;
  if (keysPressed.has("s")) cameraRotation.x -= 1.2;
  if (keysPressed.has("q")) cameraRotation.y += 1.2;
  if (keysPressed.has("e")) cameraRotation.y -= 1.2;
};


window.onload = main;