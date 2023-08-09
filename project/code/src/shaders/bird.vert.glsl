precision highp float;

attribute float globalTime; // passing as attribute rather than uniform to avoid mess distortion
attribute vec3 position;
attribute vec3 normal;

// instance attributes
attribute vec3 offset;
attribute vec4 model_c1;
attribute vec4 model_c2;
attribute vec4 model_c3;
attribute vec4 model_c4;

uniform vec4 light_position;
uniform mat4 view;
uniform mat4 projection;


/******* PERLIN NOISE CODE STARTS ********/
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
/********** PERLIN NOISE CODE ENDS **********/


/********** MATRIX OPERATIONS START **********/
/* These two functions have been taken from the internet */
mat3 transpose(mat3 inMatrix) {
    vec3 i0 = inMatrix[0];
    vec3 i1 = inMatrix[1];
    vec3 i2 = inMatrix[2];

    mat3 outMatrix = mat3(
                 vec3(i0.x, i1.x, i2.x),
                 vec3(i0.y, i1.y, i2.y),
                 vec3(i0.z, i1.z, i2.z)
                 );

    return outMatrix;
}

mat3 inverse(mat3 m) {
  float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
  float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
  float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

  float b01 = a22 * a11 - a12 * a21;
  float b11 = -a22 * a10 + a12 * a20;
  float b21 = a21 * a10 - a11 * a20;

  float det = a00 * b01 + a01 * b11 + a02 * b21;

  return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
              b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
              b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
}
/********** MATRIX OPERATIONS END **********/

void main () {
    // create model and associated matrices
    mat4 model = mat4(model_c1, model_c2, model_c3, model_c4);

	// position of vertices of bird mesh in the scene
    vec3 scene_position = position + offset;
    vec3 noise = perlin_noise(vec2(offset.x + 100. * sin(globalTime), offset.y + 100. * sin(globalTime)));
    
	if(sin(globalTime) < 0.)
		gl_Position = projection * view * model *vec4(scene_position.x + 4000. * sin(globalTime) * noise.x,  scene_position.y + 4000. * sin(globalTime) * noise.x, scene_position.z - 80. * noise.x, 1);
	else
		gl_Position = projection * view * model *vec4(scene_position.x - 4000. * sin(globalTime) * noise.x,  scene_position.y - 4000. * sin(globalTime) * noise.x, scene_position.z - 80. * noise.x, 1);	

}