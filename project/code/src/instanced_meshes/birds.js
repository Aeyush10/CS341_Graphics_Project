import { BIRD_THRESH } from "../constants.js"
import { draw_pipeline, get_positions } from "./utils.js"
import { build_mesh_normals } from "../mesh.js"

// function to draw birds on the scene
export function draw_birds(regl, resources, terrain_mesh, globalTime, mat_projection, mat_view, light_position_cam){

    // get the bird mesh
    // this function adds face normals into the mesh
    const bird_mesh = build_mesh_normals(resources['bird2.obj'])

    const birds_in_terrain = regl({
        frag: resources[`shaders/bird.frag.glsl`],
        vert: resources[`shaders/bird.vert.glsl`],
    
        attributes: {		
            position: bird_mesh.vertex_positions,
            normal: bird_mesh.vertex_normals,
            // passed as an attribute to avoid globalTime having different value for
            // different vertices since the shader code does not run for them at the same time
            globalTime: Array(bird_mesh.vertex_positions.length).fill(globalTime),
    
            // instance attributes
            offset: regl.prop('offset'),
            scale: regl.prop('scale'),
            // need to pass these as separate rows since regl does not support mat4 as an attribute
            model_c1: regl.prop('model_c1'),
            model_c2: regl.prop('model_c2'),
            model_c3: regl.prop('model_c3'),
            model_c4: regl.prop('model_c4'),
        },
    
        elements: bird_mesh.faces,
        instances: regl.prop('num_instances'),
        
        uniforms: {
            view: regl.prop('view'),
            projection: regl.prop('projection'),
            light_position: regl.prop('light_position')
        }
      })

    
    // base value of a bird
    const BIRD_SCALE = 1 / 250;
    // the offsets and scales for placing the birds
    let { translations, scales, models } = get_positions(BIRD_THRESH, terrain_mesh, BIRD_SCALE, true)

    // draw the birds on the scene
    draw_pipeline(birds_in_terrain, light_position_cam, mat_view, mat_projection, translations, scales, models)
}