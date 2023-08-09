attribute vec2 position;

varying float v2f_height;

/* #TODO PG1.6.1: Copy Blinn-Phong shader setup from previous exercises */
varying vec3 surface_normal;
varying vec3 lighting_vector;
varying vec3 view_vector;

uniform mat4 mat_mvp;
uniform mat4 mat_model_view;
uniform mat3 mat_normals; // mat3 not 4, because normals are only rotated and not translated
uniform vec3 camera_direction;
uniform float globalTime;

uniform float viewer_scale;
uniform vec2 viewer_position;

uniform vec4 light_position; //in camera space coordinates already
const float terrain_water_level    = -0.03125 + 1e-6;
const float WATER_LEVEL = -0.03125;


/********* NOISE CODE STARTS **********/
#define NUM_GRADIENTS 12

// -- Gradient table --
vec2 gradients(int i) {
	if (i ==  0) return vec2( 1,  1);
	if (i ==  1) return vec2(-1,  1);
	if (i ==  2) return vec2( 1, -1);
	if (i ==  3) return vec2(-1, -1);
	if (i ==  4) return vec2( 1,  0);
	if (i ==  5) return vec2(-1,  0);
	if (i ==  6) return vec2( 1,  0);
	if (i ==  7) return vec2(-1,  0);
	if (i ==  8) return vec2( 0,  1);
	if (i ==  9) return vec2( 0, -1);
	if (i == 10) return vec2( 0,  1);
	if (i == 11) return vec2( 0, -1);
	return vec2(0, 0);
}

float hash_poly(float x) {
	return mod(((x*34.0)+1.0)*x, 289.0);
}

// -- Hash function --
// Map a gridpoint to 0..(NUM_GRADIENTS - 1)
int hash_func(vec2 grid_point) {
	return int(mod(hash_poly(hash_poly(grid_point.x) + grid_point.y), float(NUM_GRADIENTS)));
}

// -- Smooth interpolation polynomial --
// Use mix(a, b, blending_weight_poly(t))
float blending_weight_poly(float t) {
	return t*t*t*(t*(t*6.0 - 15.0)+10.0);
}

// added for the calculation of the derivative of perlin noise
vec2 blending_weight_poly(vec2 t) {
	return t*t*t*(t*(t*6.0 - 15.0)+10.0);
}

vec2 blending_weight_poly_derivative(vec2 t) {
	return 30.0*t*t*(t*(t-2.0)+1.0);
}

vec3 perlin_noise(vec2 point) {
	vec2 c00 = vec2(int(floor(point.x)), int(floor(point.y)));
	vec2 c01 = c00 + vec2(0, 1);
	vec2 c10 = c00 + vec2(1, 0);
	vec2 c11 = c00 + vec2(1, 1);

	vec2 a = point - c00;
	vec2 b = point - c10;
	vec2 c = point - c01;
	vec2 d = point - c11;

	float s = dot(gradients(hash_func(c00)), a);
	float t = dot(gradients(hash_func(c10)), b);
	float u = dot(gradients(hash_func(c01)), c);
	float v = dot(gradients(hash_func(c11)), d);

	float st = mix(s, t, blending_weight_poly(a.x));
	float uv = mix(u, v, blending_weight_poly(a.x));
	float noise = mix(st, uv, blending_weight_poly(a.y));

	// expression of derivative taken from https://iquilezles.org/articles/gradientnoise/
	return vec3(noise, 
		gradients(hash_func(c00))
		+ blending_weight_poly(a).x * (gradients(hash_func(c10)) - gradients(hash_func(c00)))
		+ blending_weight_poly(a).y * (gradients(hash_func(c01)) - gradients(hash_func(c00)))
		+ blending_weight_poly(a).x * blending_weight_poly(a).y * (
			gradients(hash_func(c00)) + gradients(hash_func(c11))
			- gradients(hash_func(c10)) - gradients(hash_func(c01))
		)
		+ blending_weight_poly_derivative(a) * (
			blending_weight_poly(a).yx * (s + v - u - t)
			+ vec2(t, u)
			- s
		)
	);
}

// Constants for FBM
const float freq_multiplier = 2.17;
const float ampl_multiplier = 0.5;
const int num_octaves = 4;


vec3 perlin_fbm(vec2 point) {
	vec3 fbm = perlin_noise(point); //Octave 0
	float a = ampl_multiplier;
	float omega = freq_multiplier;
	//Octaves 1-3: 
	for(int i = 1; i < num_octaves; i++) {
		vec3 new_octave = a * perlin_noise(point * omega);
		fbm += vec3(new_octave.x, new_octave.yz * omega);
		a = a * a; //doing this because not sure if I have access to pow function...
		omega = omega * omega;
	}
	return fbm;	
}

vec3 tex_fbm_for_terrain(vec2 point) {
	// scale by 0.25 for a reasonably shaped terrain
	// the +0.5 transforms it to 0..1 range - for the case of writing it to a non-float textures on older browsers or GLES3
	// add 0.5 only to noise, not to the derivatives
	vec3 noise_val = (perlin_fbm(point) * 0.25) + vec3(0.5, 0., 0.);
	return noise_val;
}
/********* NOISE CODE ENDS **********/


void main()
{
	vec2 local_coord =  2. * position.xy * viewer_scale;
	vec2 v2f_tex_coords = viewer_position + local_coord;
	vec3 noise_value = tex_fbm_for_terrain(v2f_tex_coords);

	// noise value lies in the range (0,1) so we subtract 0.5 to get it in the range (-0.5,0.5)
	v2f_height = noise_value.x - 0.5;
	vec3 position_new = vec3(position.x, position.y, v2f_height);
    vec4 position_v4 = vec4(position_new,1);

	// the yz components of noise_value contain the derivatives of the noise function
	vec3 normal = normalize(vec3(-noise_value.yz, 1));

    
    vec4 vertex_position_temp = mat_model_view * position_v4;
    vec3 vertex_position_eye = vertex_position_temp.xyz;
	vec3 temp_norm = vec3(0.0,0.0,0.0);
	surface_normal = normalize(mat_normals*normal);	
    view_vector = normalize(camera_direction - vertex_position_eye);
    lighting_vector = normalize(light_position.xyz - vertex_position_eye);
    if (position_new.z < terrain_water_level) {
		//Change the position of the vertex position using sinusoid and noise function to create animated wave
	    float water_height = position_new.z/7.0 + 0.02*sin(10.0*position_new.z + 10.0*position.x + 10.0*position.y + 1000.0*globalTime);
		gl_Position = mat_mvp * vec4(position.xy, water_height ,1);
		temp_norm = vec3(normal.x/7.0 + 0.2*cos(10.0*position_new.z + 10.0*position.x + 10.0*position.y + 1000.0*globalTime)*(normal.x + 1.0) , normal.y/7.0 + 0.2*cos(10.0*position_new.z + 10.0*position.x + 10.0*position.y+ 1000.0*globalTime)*(normal.y + 1.0) , 1.0/7.0 + 0.2*cos(10.0*position_new.z + 10.0*position.x + 10.0*position.y+ 1000.0*globalTime) );
		surface_normal = normalize(mat_normals*(temp_norm));
	}
	else
		//Not a water pixel 
    	gl_Position = mat_mvp * vec4(position_new, 1);
}
