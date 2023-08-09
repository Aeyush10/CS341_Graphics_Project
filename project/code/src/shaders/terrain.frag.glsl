precision highp float;

varying float v2f_height;
varying vec3 surface_normal;
varying vec3 lighting_vector;
varying vec3 view_vector;

uniform float globalTime;
uniform float mouseposX;
uniform float mouseposY;
uniform samplerCube water_cubemap;

// Small perturbation to prevent "z-fighting" on the water on some machines...
const float terrain_water_level    = -0.03125 + 1e-6;
const vec3  light_color = vec3(1.0, 0.941, 0.898);
const vec3  terrain_color_mountain = vec3(0.8, 0.5, 0.4);
const vec3  terrain_color_grass    = vec3(0.33, 0.43, 0.18);

void main()
{
	const vec3 ambient = 0.2 * light_color; // Ambient light intensity
	float height = v2f_height;

	vec3 surf_norm_new = normalize(surface_normal);
    vec3 dir_to_camera_new = normalize(view_vector);
    vec3 refl_direction = normalize(2.*dot(surf_norm_new,dir_to_camera_new)*surf_norm_new - dir_to_camera_new);
	vec3 material_color = terrain_color_grass;
	float shininess = 0.5;
	
	vec3 water_color = vec3(0.0,0.0,0.0);
	float water_shininess = 0.;

	vec3 ground_color = mix(terrain_color_grass, terrain_color_mountain, (height - terrain_water_level) * 2.);
	float ground_shininess = 2.; 
	
	/* 
    	Phong shading model by using the passed variables and write the resulting color to `color`.
    	`material_color` should be used as material parameter for ambient, diffuse and specular lighting.
	*/
	
	vec3 normal = normalize(surface_normal);
	vec3 lighting_vec_normalized = normalize(lighting_vector);
	vec3 h = normalize(view_vector + lighting_vec_normalized);
	vec3 color_var = ambient;

	/*Constants for water varying with noise for project */
	float noise_scale = 1.;
	float time_scale = 1.;

	if(height < terrain_water_level){
		if(dot(lighting_vector, normal) > 0.){
			color_var += (0.4*light_color * dot(normal, lighting_vec_normalized));
			if(dot(normal, h) > 0.){
				color_var += (0.4*light_color * pow(dot(h, normal), water_shininess));
			}
		}
		
		color_var *= water_color;		
	}
	else{
		if(dot(lighting_vector, normal) > 0.){
			color_var += light_color * dot(normal, lighting_vec_normalized);
			if(dot(normal, h) > 0.){
				color_var += light_color * pow(dot(h, normal), ground_shininess);
			}
		}
		color_var *= ground_color;
	}

	vec3 color = color_var;
	gl_FragColor = vec4(color, 1.); // output: RGBA in 0..1 range

	if(height < terrain_water_level){
		gl_FragColor = textureCube(water_cubemap,refl_direction);
		vec3 refl_direction = normalize(2.*dot(surf_norm_new,dir_to_camera_new)*surf_norm_new - dir_to_camera_new);
	}
}


