async function main() {
	await initialize();

	requestAnimationFrame(render);
}

//Constants 
const NUM_ITEMS = 10;
const ITEM_RADIUS = 10;
const KEYS = ["w", "s", "a", "d", "q", "e"];
const SCALE_FACTOR = 0.4;
const ROTATION_Y_SPEED = 0.005;
const LERP_SPEED_INVENTORY = 0.0065;


// this data is set in initialize() and used in render()
let gl;
let program;
let vao;
let uniformModelMatrixLocation;
let uniformViewMatrixLocation;
let uniformProjectionMatrixLocation;

let inspectMode = false;
let cameraRotation = { x: 12.5, y: 0 };
let cameraTranslation = {x: 0, y: 1, z: 20}; //z = camera Distance

const items = [];
let selectedItemIndex = 0;
let previousItemIndex = 0;

// switch between items
let startAngle = 0;
let targetAngle = 0;
let currentAngle = 0;
let rotationProgressCarousel = 1;

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
		const lookAtAngleY = Math.atan2(x,z);

		const hue = (i/NUM_ITEMS) * 360;
		const color = hslToRgb(hue, 0.8, 0.6);

		items.push({
			position: {x, y: 0, z},
			angle,
			color: color,
			id: i,
			scaleFactor: 1.0,
			rotationYStart: 0.0,
			rotationY: lookAtAngleY,
			lookAtAngleY: lookAtAngleY,
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
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(monkeyMesh.indices), gl.STATIC_DRAW);

	const posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(monkeyMesh.positions), gl.STATIC_DRAW);
	const posAttributeLocation = gl.getAttribLocation(program, "a_position");
	gl.vertexAttribPointer(posAttributeLocation, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(posAttributeLocation);

	const uvBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(monkeyMesh.uvs), gl.STATIC_DRAW);
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

	updateCameraRotation();
	updateInventoryLerp()


	const { viewMatrix, projectionMatrix } = setMatrices();
	const numVertices = monkeyMesh.indices.length;
	
	if(inspectMode)
	{
		const item = items[selectedItemIndex];
		updateItemScaleAndRotation(item, selectedItemIndex);

		const modelMatrix = buildItemModelMatrix(item, selectedItemIndex);
		gl.uniformMatrix4fv(uniformModelMatrixLocation, true, modelMatrix);
		gl.uniform3fv(uniformColorLocation, item.color);
		gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_SHORT, 0);
	}
	else
	{
		for(let i = 0; i < items.length; i++)
		{
			const item = items[i];
	
			updateItemScaleAndRotation(item, i);
	
			const modelMatrix = buildItemModelMatrix(item, i);
			
			gl.uniformMatrix4fv(uniformModelMatrixLocation, true, modelMatrix);
			gl.uniform3fv(uniformColorLocation, item.color);
			gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_SHORT, 0);
		}
	}
		
	// we set transpose to true to convert to column-major
	gl.uniformMatrix4fv(uniformViewMatrixLocation, true, viewMatrix);
	gl.uniformMatrix4fv(uniformProjectionMatrixLocation, true, projectionMatrix);

	// unbind to avoid accidental modification
	gl.bindVertexArray(vao);
	gl.useProgram(null);

	requestAnimationFrame(render);
}

function buildItemModelMatrix(item, index){
	let modelMatrix = mat4Translation(item.position.x, item.position.y, item.position.z);	
	
	//deprecated lookAt(camera)
	// let rotationMatrix = lookAtXZ(item, worldCamerPos);
			
	let rotationMatrix = mat4RotY(item.rotationY);
			
	modelMatrix = mat4Mul(modelMatrix, rotationMatrix);
	modelMatrix = mat4Mul(modelMatrix, mat4Scale(item.scaleFactor, item.scaleFactor, item.scaleFactor));

	return modelMatrix;
}

function setMatrices() {	
	const targetRotationY = -(currentAngle * 180 / Math.PI) + cameraRotation.y; //grad
	let viewMatrix;
	//deprecated
	// const cameraWorldPos = getCameraWorldPosition(cameraRotation.x, -targetRotationY, cameraTranslation.z);

	if(inspectMode)
	{
		const itemPos = items[selectedItemIndex].position;
		const inspectDistance = 10;

		const vT1 = mat4Translation(-itemPos.x, -itemPos.y, -itemPos.z);

		const ry = mat4RotY(cameraRotation.y * Math.PI / 180);
		const rx = mat4RotX(cameraRotation.x * Math.PI / 180);

		const vT2 = mat4Translation(0, 0, -inspectDistance);
		viewMatrix = mat4Mul(vT2, mat4Mul(rx, mat4Mul(ry, vT1)));
	}
	else
	{		
		//viewMatrix
		const vT = mat4Translation(cameraTranslation.x, cameraTranslation.y, -cameraTranslation.z);
		const vRy = mat4RotY((targetRotationY * Math.PI / 180));
		const vRx = mat4RotX(cameraRotation.x * Math.PI / 180);
		viewMatrix = mat4Mul(vT, mat4Mul(vRx, vRy));
	}

	//projectionMatrix
	const canvasWrapper = document.querySelector("#canvasWrapper");
	const aspectRatio = canvasWrapper.clientWidth / canvasWrapper.clientHeight;
	//angle, aspectRatio, near-clipping, far-clipping => !Frustum!
	const projectionMatrix = perspective(45, aspectRatio, 0.1, 100);

	return {viewMatrix, projectionMatrix}
}

function updateItemScaleAndRotation(item, index){
	if(inspectMode) return;
	//scaling of item
	if(index === selectedItemIndex && rotationProgressCarousel < 1){
		item.scaleFactor = 1.0 + SCALE_FACTOR * easeInOutQuad(rotationProgressCarousel);
	}
	else if(index === previousItemIndex && rotationProgressCarousel < 1){
		const step_t = easeInOutQuad(rotationProgressCarousel);
		item.scaleFactor = 1.4 - SCALE_FACTOR * step_t
		
		const shortestAngle = shortestAngleBetween(item.rotationYStart, item.lookAtAngleY);
		item.rotationY = item.rotationYStart + shortestAngle * step_t;
	}
	else if(index === selectedItemIndex && rotationProgressCarousel >= 1){
		item.scaleFactor = 1.0 + SCALE_FACTOR;
		item.rotationY += ROTATION_Y_SPEED;
	}
}

//smooth rotation when switching between items
function updateInventoryLerp(){
	if(rotationProgressCarousel < 1)
	{
		rotationProgressCarousel += LERP_SPEED_INVENTORY;

		if (rotationProgressCarousel > 1) rotationProgressCarousel = 1;

		const shortestAngle = shortestAngleBetween(startAngle, targetAngle);
		const step_t = easeInOutQuad(rotationProgressCarousel);
		currentAngle = startAngle + shortestAngle * step_t;
	}
	else{
		currentAngle = targetAngle;
	}
}

//deprecated
function lookAtXZ(sourceItem, targetObject)
{
	//look at the camera on the XZ-Plane
	const toCameraX = targetObject.x - sourceItem.position.x;
	const toCameraZ = targetObject.z - sourceItem.position.z;
	const lookAtAngleY = Math.atan2(toCameraX, toCameraZ);
	return mat4RotY(lookAtAngleY); 
}

//deprecated
function getCameraWorldPosition(rotXDeg, rotYDeg, distance) {
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
	
	//from (0,0,0) => for another centerPoint add them to every coord 
	return {
		x: dir.x * distance,
		y: dir.y * distance,
		z: dir.z * distance
	};
}

function rotateInventory(direction) {
	previousItemIndex = selectedItemIndex;
	items[previousItemIndex].rotationYStart = items[previousItemIndex].rotationY;
	
	selectedItemIndex = (selectedItemIndex + direction + NUM_ITEMS) % NUM_ITEMS;

	startAngle = currentAngle;
	targetAngle = items[selectedItemIndex].angle;
	rotationProgressCarousel = 0;
}

function updateCameraRotation() {
	if(!inspectMode) return;
	if (keysPressed.has("w")) cameraRotation.x += 1.2;
	if (keysPressed.has("s")) cameraRotation.x -= 1.2;
	if (keysPressed.has("d")) cameraRotation.y += 1.2;
	if (keysPressed.has("a")) cameraRotation.y -= 1.2;
};

//listerners
window.addEventListener("keydown", (event) => {
	const key = event.key.toLowerCase();
	
	if(inspectMode && rotationProgressCarousel >= 1.0)
	{
		if(key === "q") 
		{
			inspectMode = false;
			return;
		}
	}

	// coolodown for button press
	if(!inspectMode && rotationProgressCarousel >= 1.0)
	{
		if(key === "a") rotateInventory(-1);
		if(key === "d") rotateInventory(1);
		if(key === "q") inspectMode = true;
		return;
	}
	
	if(KEYS.includes(key)) keysPressed.add(key);
});

window.addEventListener("keyup", (event) => {
	keysPressed.delete(event.key.toLowerCase());
});


window.onload = main;