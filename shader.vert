#version 300 es

// attribute data
in vec3 a_position;
in vec2 a_uv;

// varying data
out vec2 v_uv;

uniform mat4x4 u_modelMatrix;
uniform mat4x4 u_viewMatrix;
uniform mat4x4 u_projectionMatrix;

void main() {
	gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 1.0);
	v_uv = a_uv;
}
