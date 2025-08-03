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

let crtProgram, crtVAO, crtFrameBuffer, sceneTexture, crtConfig;

// this data is set in initialize() and used in render()
const meshCache = {};
let gl;
let program;
let uniformModelMatrixLocation;
let uniformViewMatrixLocation;
let uniformProjectionMatrixLocation;

let inspectMode = false;
let cameraRotation = { x: 12.5, y: 0 };
let cameraTranslation = {x: 0, y: 1, z: 20}; //z = camera Distance
let inspectModeCameraRotation = {...cameraRotation};

const items = [];
let selectedItemIndex = 0;
let previousItemIndex = 0;

// switch between items
let startAngle = 0;
let targetAngle = 0;
let currentAngle = 0;
let rotationProgressCarousel = 1;

let backgroundTexture;

//input "manager" for simultaneously button presses
const keysPressed = new Set();

async function initialize() {
	const canvas = document.querySelector("canvas"); // get the html canvas element
	const canvasWrapper = document.querySelector("#canvasWrapper");
	
	// everytime we talk to WebGL we use this object
	gl = canvas.getContext("webgl2", { alpha: false });

	if (!gl) { 
		console.error("Your browser does not support WebGL2");
		return; 
	}

	// set the resolution of the html canvas element
	canvas.width = canvasWrapper.clientWidth;
	canvas.height = canvasWrapper.clientHeight;
	
	// set the resolution of the framebuffer
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	
	gl.enable(gl.CULL_FACE); // enable back-face culling

	// loadTextResource returns a string that contains the content of a text file
	const vertexShaderText = await loadTextResource("shader.vert");
	const fragmentShaderText = await loadTextResource("shader.frag");
	// compile GLSL shaders - turn shader code into machine code that the GPU understands
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderText);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderText);
	// link the two shaders - create a program that uses both shaders
	program = createProgram(gl, vertexShader, fragmentShader);
	
	
	uniformColorLocation = gl.getUniformLocation(program, "u_color");
	uniformTextureLocation = gl.getUniformLocation(program, "u_texture");
	
	uniformModelMatrixLocation = gl.getUniformLocation(program, "u_modelMatrix");
	uniformViewMatrixLocation = gl.getUniformLocation(program, "u_viewMatrix");
	uniformProjectionMatrixLocation = gl.getUniformLocation(program, "u_projectionMatrix");

	uploadBackgroundData();

	//loading meshes and textures
	const videotapeMesh_025 = scaleMesh(videotapeMeshbox, 0.25);
	const monkeyMesh_1 = scaleMesh(monkeyMesh, 1);
	const stockpotMesh_2 = scaleMesh(stockpotMesh, 2);
	const cardBoardMesh_05 = scaleMesh(cardBoardMesh, 0.5); 
	const torusMesh_1 = scaleMesh(torusMesh, 1);
	const bulletMesh_1 = scaleMesh(bulletsMesh, 0.25);
	const meshArray = [videotapeMesh_025, monkeyMesh_1, stockpotMesh_2, cardBoardMesh_05, torusMesh_1, bulletMesh_1];

	const videotapeTexture = await loadTexture(gl, "./textures/videoTape.png");
	const monkeyMeshTexture = await loadTexture(gl, "./textures/wooden_gate_diff_1k.png"); 
	const cardBoardTexture = await loadTexture(gl, "./textures/cardBoard.png");
	const stockpotTexture = await loadTexture(gl, "./textures/crockPot.png");
	const torusTexture = await loadTexture(gl, "./textures/rosewood_veneer1_diff_1k.png")
	const bulletTexture = await loadTexture(gl, "./textures/bullet.png");
	const textureArray = [videotapeTexture, monkeyMeshTexture, stockpotTexture, cardBoardTexture, torusTexture, bulletTexture];

	backgroundTexture = await loadTexture(gl, "./textures/leather_red_03_coll1_1k.png");

	for (let i = 0; i < NUM_ITEMS; i++)
	{
		// calculate angle in radiant for every object => Bsp: 1/8 * 2 * PI = 0.785
		const angle = (i / NUM_ITEMS) * 2 * Math.PI;
		const x = Math.sin(angle) * ITEM_RADIUS;
		const z = Math.cos(angle) * ITEM_RADIUS;
		const lookAtAngleY = Math.atan2(x,z);
		
		const mesh = meshArray[i % meshArray.length];
		const texture = textureArray[i % textureArray.length];
		const {vao, numIndices} = getOrCreateVAO(mesh, i % meshArray.length)

		items.push({
			position: {x, y: 0, z},
			angle,
			id: i,
			mesh: mesh,
			texture: texture,
			vao: vao,
			numIndices: numIndices,
			scaleFactor: 1.0,
			rotationYStart: 0.0,
			rotationY: lookAtAngleY,
			lookAtAngleY: lookAtAngleY,
		});
	}

	await createCRTPostProcess();
}

function getOrCreateVAO(mesh, id) {
	if (meshCache[id]) return meshCache[id];
	const vaoData = uploadAttributeData(mesh);
	meshCache[id] = vaoData;
	return vaoData;
}

function uploadAttributeData(mesh) {
	const vao_temp = gl.createVertexArray();
	gl.bindVertexArray(vao_temp);

	const indexBuffer = gl.createBuffer();
	// gl.ELEMENT_ARRAY_BUFFER tells WebGL that this buffer should be treated as an index list
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);

	const posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
	const posAttributeLocation = gl.getAttribLocation(program, "a_position");
	gl.vertexAttribPointer(posAttributeLocation, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(posAttributeLocation);

	const uvBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.STATIC_DRAW);
	const uvAttributeLocation = gl.getAttribLocation(program, "a_uv");
	gl.vertexAttribPointer(uvAttributeLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(uvAttributeLocation);

	// unbind to avoid accidental modification
	gl.bindVertexArray(null); // before other unbinds
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	return {vao: vao_temp, numIndices: mesh.indices.length};
}

function uploadBackgroundData(){
	backgroundVAO = gl.createVertexArray();
	gl.bindVertexArray(backgroundVAO);

	const indexBuffer = gl.createBuffer();
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

	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function render(time) {
	//render scene in offscreen
	gl.bindFramebuffer(gl.FRAMEBUFFER, crtFrameBuffer);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.clear(gl.DEPTH_BUFFER_BIT);

	gl.useProgram(program);

	gl.disable(gl.DEPTH_TEST); // disable z-buffering
	drawBackground();
	
	gl.enable(gl.DEPTH_TEST); // enable z-buffering
	drawItems();

	//use crt || null => go back to monitor
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.useProgram(crtProgram);
	gl.bindVertexArray(crtVAO);

	const uniformTextureLocation = gl.getUniformLocation(crtProgram, "u_texture");

	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_time"), time * 0.001);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_barrel"), crtConfig.barrelDistortion);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_aberration"), crtConfig.chromaticAberration);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_noise"), crtConfig.staticNoise);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_tearing"), crtConfig.horizontalTearing);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_glow"), crtConfig.glowBloom);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_jitter"), crtConfig.verticalJitter);
	gl.uniform1i(gl.getUniformLocation(crtProgram, "u_retrace"), crtConfig.retraceLines);
	gl.uniform1i(gl.getUniformLocation(crtProgram, "u_dotMask"), crtConfig.dotMask);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_brightness"), crtConfig.brightness);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_contrast"), crtConfig.contrast);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_desaturation"), crtConfig.desaturation);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_flicker"), crtConfig.flicker);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_scanlineIntensity"), crtConfig.scanlineIntensity);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_curvature"), crtConfig.curvature);
	gl.uniform1f(gl.getUniformLocation(crtProgram, "u_signalLoss"), crtConfig.signalLoss);

	gl.activeTexture(gl.TEXTURE0);
	//connect crtScene with my sceneTexture from the offscreenBuffer
	gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
	gl.uniform1i(uniformTextureLocation, 0);

	gl.drawElements(gl.TRIANGLES, quadMesh.indices.length, gl.UNSIGNED_SHORT, 0);

	// unbind to avoid accidental modification
	gl.bindVertexArray(null);
	gl.useProgram(null);

	requestAnimationFrame(render);
}

function drawItems(){
	updateCameraRotation();
	updateInventoryLerp()

	const { viewMatrix, projectionMatrix } = setMatrices();
	
	// we set transpose to true to convert to column-major
	gl.uniformMatrix4fv(uniformViewMatrixLocation, true, viewMatrix);
	gl.uniformMatrix4fv(uniformProjectionMatrixLocation, true, projectionMatrix);
	
	if(inspectMode)
	{
		const item = items[selectedItemIndex];
		updateItemScaleAndRotation(item, selectedItemIndex);

		const modelMatrix = buildItemModelMatrix(item);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, items[selectedItemIndex].texture);
		gl.uniform1i(uniformTextureLocation, 0);
		gl.bindVertexArray(items[selectedItemIndex].vao);	
		
		gl.uniformMatrix4fv(uniformModelMatrixLocation, true, modelMatrix);
		gl.drawElements(gl.TRIANGLES,  items[selectedItemIndex].numIndices, gl.UNSIGNED_SHORT, 0);
	}
	else
	{
		for(let i = 0; i < items.length; i++)
		{
			const item = items[i];
			updateItemScaleAndRotation(item, i);
	
			const modelMatrix = buildItemModelMatrix(item);
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, item.texture);
			gl.uniform1i(uniformTextureLocation, 0);
			gl.bindVertexArray(item.vao);	

			gl.uniformMatrix4fv(uniformModelMatrixLocation, true, modelMatrix);
			gl.drawElements(gl.TRIANGLES, items[i].numIndices, gl.UNSIGNED_SHORT, 0);
		}
	}
}

function drawBackground(){
	gl.bindVertexArray(backgroundVAO);

	const matIdentity = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	];

	gl.uniformMatrix4fv(uniformModelMatrixLocation, true, matIdentity);
	gl.uniformMatrix4fv(uniformViewMatrixLocation, true, matIdentity);
	gl.uniformMatrix4fv(uniformProjectionMatrixLocation, true, matIdentity);

	//texture binden
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
	gl.uniform1i(uniformTextureLocation, 0);

	gl.drawElements(gl.TRIANGLES, quadMesh.indices.length, gl.UNSIGNED_SHORT, 0);
}

function buildItemModelMatrix(item){
	let rotationMatrix;
	let modelMatrix = mat4Translation(item.position.x, item.position.y, item.position.z);	

	rotationMatrix = mat4RotY(item.rotationY);

	modelMatrix = mat4Mul(modelMatrix, rotationMatrix);
	modelMatrix = mat4Mul(modelMatrix, mat4Scale(item.scaleFactor, item.scaleFactor, item.scaleFactor));

	return modelMatrix;
}

function setMatrices() {	
	let viewMatrix;

	if(inspectMode)
	{		
		viewMatrix = getViewMatrixInspect();
	}
	else
	{	
		viewMatrix = getViewMatrixCarousel();
	}

	//projectionMatrix
	const canvasWrapper = document.querySelector("#canvasWrapper");
	const aspectRatio = canvasWrapper.clientWidth / canvasWrapper.clientHeight;
	//angle, aspectRatio, near-clipping, far-clipping => !Frustum!
	const projectionMatrix = perspective(45, aspectRatio, 0.1, 100);

	return {viewMatrix, projectionMatrix}
}

function getViewMatrixCarousel(){
	const targetRotationY = -(currentAngle * 180 / Math.PI); //grad

	const vT = mat4Translation(cameraTranslation.x, cameraTranslation.y, -cameraTranslation.z);
	const vRy = mat4RotY((targetRotationY * Math.PI / 180));
	const vRx = mat4RotX(cameraRotation.x * Math.PI / 180);

	return mat4Mul(vT, mat4Mul(vRx, vRy));
}

function getViewMatrixInspect(){
	const itemPos = items[selectedItemIndex].position;
	const inspectDistance = 10;

	const vT1 = mat4Translation(-itemPos.x, -itemPos.y, -itemPos.z);
	const ry = mat4RotY(inspectModeCameraRotation.y * Math.PI / 180);
	const rx = mat4RotX(inspectModeCameraRotation.x * Math.PI / 180);

	const vT2 = mat4Translation(0, 0, -inspectDistance);

	return mat4Mul(vT2, mat4Mul(rx, mat4Mul(ry, vT1)));
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
	if (keysPressed.has("w")) inspectModeCameraRotation.x += 1.2;
	if (keysPressed.has("s")) inspectModeCameraRotation.x -= 1.2;
	if (keysPressed.has("d")) inspectModeCameraRotation.y += 1.2;
	if (keysPressed.has("a")) inspectModeCameraRotation.y -= 1.2;
};

//listerners
window.addEventListener("keydown", (event) => {
	const key = event.key.toLowerCase();
	
	if(inspectMode && rotationProgressCarousel >= 1.0)
	{
		if(key === "q") 
		{
			inspectMode = false;
			inspectModeCameraRotation.x = 0.0;
			inspectModeCameraRotation.y = 0.0;
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




//CRT-POSTPROCESS
async function createCRTPostProcess()
{
	crtConfig = Object.assign({
		barrelDistortion: 0.002, //crt curvature
		curvature: 0.002, //adjust curvature
		chromaticAberration: 0.0005, //slightly separates RGB colors
		horizontalTearing: 0.00012, //horizontal distortion
		glowBloom: 0.001, //glow of crt pixels
		verticalJitter: 0.001, //oscillate vertically
		retraceLine: true, //adds crt refresh lines
		scanlineIntensity: 0.6, //adjust scnaline intensity
		dotMask: false, //simulates pixel structure of crt
		brightness: 1.0,
		contrast: 1.0,
		desaturation: 0.1, //reduces color saturation for a faded effect
		flicker: 0.01, //occasional flicker
		signalLoss: 0.05 //VHS signal loss artifacts
	});

	const crtShaderText = await loadTextResource("crtShader.vert");
	const crtFShaderText = await loadTextResource("crtShader.frag");

	const crtShader = createShader(gl, gl.VERTEX_SHADER, crtShaderText);
	const crtFShader = createShader(gl, gl.FRAGMENT_SHADER, crtFShaderText);
	
	crtProgram = createProgram(gl, crtShader, crtFShader);
	crtVAO = gl.createVertexArray();
	gl.bindVertexArray(crtVAO);

	const indexBuffer = gl.createBuffer();
	// // gl.ELEMENT_ARRAY_BUFFER tells WebGL that this buffer should be treated as an index list
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(quadMesh.indices), gl.STATIC_DRAW);

	const posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadMesh.positions), gl.STATIC_DRAW);
	const posAttributeLocation = gl.getAttribLocation(crtProgram, "a_position");
	gl.vertexAttribPointer(posAttributeLocation, 3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(posAttributeLocation);

	const uvBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadMesh.uvs), gl.STATIC_DRAW);
	const uvAttributeLocation = gl.getAttribLocation(crtProgram, "a_uv");
	gl.vertexAttribPointer(uvAttributeLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(uvAttributeLocation);

	gl.bindVertexArray(null);

	//create framebuffer and sceneTexture => everything from my scene is saved in a texture
	crtFrameBuffer = gl.createFramebuffer();
	sceneTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
	//create empty texture
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	const depthBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
	//16-bit depthbuffer needed to render scene with the correct depth
	//depthbuffer is used for shadow mapping if you save it also as texture
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height);

	//save scene as texture 
	gl.bindFramebuffer(gl.FRAMEBUFFER, crtFrameBuffer);
	//connect scene with framebuffer
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTexture, 0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

window.onload = main;