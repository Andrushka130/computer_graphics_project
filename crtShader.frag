#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision mediump float;

in vec2 v_uv;

uniform sampler2D u_texture;

uniform float u_time;

out vec4 outColor;


// BIG SHOUTOUTS => https://github.com/Ichiaka/CRTFilter 
// and https://www.shadertoy.com/view/4scSR8
// and 
void main() {
	vec2 uv = v_uv;

	vec3 color;
	//chormatic abberation of 0.0005 => //slightly separates RGB colors
	color.r = texture(u_texture, uv + vec2(0.001, 0)).r;
	color.g = texture(u_texture, uv).g;
	color.b = texture(u_texture, uv - vec2(0.001, 0)).b;

	//jitter screen verticaly 
	uv.y += sin(u_time * 5.0) * 0.001;
	
	//scanlines and let them flow vertically
	//(uv.y + scanlineItensity + vertical flow) * strength/thickness of the scanlines 
	float scanline = sin(uv.y * 600.0 + u_time * 5.0) * 0.1;

	//simulate curveture by adding "fish lence shadows"
	float vignette = smoothstep(0.85, 0.5, length(uv - 0.5));

	color *= (1.0 - scanline);
	color *= vignette;

	//increase contrast
	color = (color - 0.5) * 1.05 + 0.5;

	//increase brigthness
	color *= 1.4;

	outColor = vec4(color, 1.0);
}