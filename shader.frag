#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;

uniform vec3 u_color; 

out vec4 outColor;

void main() {
	outColor = texture(u_texture, v_uv);
}
