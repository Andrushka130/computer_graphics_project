#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
uniform bool u_useTexture;

uniform vec3 u_color; 

out vec4 outColor;

void main() {
	if(u_useTexture){
		outColor = texture(u_texture, v_uv);
	}
	else{
		vec3 color = u_color * (0.5 + 0.5 * vec3(v_uv, 0.5));
		outColor = vec4(color, 1.0);
	}
}
