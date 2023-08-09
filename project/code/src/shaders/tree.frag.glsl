precision highp float;

varying vec3 surface_normal;
varying vec3 lighting_vector;
varying vec3 view_vector;
varying vec3 vertex_color;

const vec3  light_color = vec3(1.0, 0.941, 0.898);

void main () {
    const vec3 ambient = 0.8 * light_color; // Ambient light intensity

    vec3 normal = normalize(surface_normal);
    vec3 lighting_vec_normalized = normalize(lighting_vector);
    vec3 h = normalize(view_vector + lighting_vec_normalized);

    vec3 color_var = ambient;

    if(dot(lighting_vector, normal) > 0.){
        color_var += light_color * dot(normal, lighting_vec_normalized);
        if(dot(normal, h) > 0.) color_var += light_color * pow(dot(h, normal), 0.5);
    }

    // give the color var a color according to whether the vertex
    // lies on the leaves or the trunk
    color_var *= vertex_color;
    gl_FragColor = vec4(color_var, 1.);
}