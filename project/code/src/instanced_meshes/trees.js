import { MouseCoordinates } from "../shared.js"
import { TREE_THRESH } from "../constants.js"
import { draw_pipeline, get_positions } from "./utils.js"
import { build_mesh_normals } from "../mesh.js"

// function to draw trees on the scene
export function draw_trees(regl, resources, terrain_mesh, mat_projection, mat_view, light_position_cam){

	// get the tree mesh
    // this function adds face normals into the mesh
    const tree_mesh = build_mesh_normals(resources['tree2.obj'])

    const tree_in_terrain = regl({
		frag: resources["shaders/tree.frag.glsl"],
		vert: resources["shaders/tree.vert.glsl"],
	
		attributes: {		
			position: tree_mesh.vertex_positions,
			normal: tree_mesh.vertex_normals,

			// each vertex has a different color depending upon whether that vertex is
			// present on the leaves or the trunk
			color: tree_mesh.vertex_colors,

			// instance attributes
			offset: regl.prop('offset'),
			scale: regl.prop('scale'),

			// need to pass these as separate rows since regl does not support mat4 as an attribute
			model_c1: regl.prop('model_c1'),
			model_c2: regl.prop('model_c2'),
			model_c3: regl.prop('model_c3'),
			model_c4: regl.prop('model_c4'),
		},

		elements: tree_mesh.faces,
		instances: regl.prop('num_instances'),
	  
		uniforms: {
			light_position: regl.prop('light_position'),
			view: regl.prop('view'),
			projection: regl.prop('projection'),
			viewer_scale: 1.0,
			// the mouse offset is used to move the trees when the terrain is moved
			viewer_position: [-MouseCoordinates.mouse_offset_X, -MouseCoordinates.mouse_offset_Y]
		}
	  })

	// base size of a tree
	const TREE_SCALE = 1/20
	// the offsets and scales for placing the trees
	let {translations, scales, models} = get_positions(TREE_THRESH, terrain_mesh, 1/20);
	
	// draw the trees on the scene
    draw_pipeline(tree_in_terrain, light_position_cam, mat_view, mat_projection, translations, scales, models)
}