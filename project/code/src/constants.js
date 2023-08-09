export const GRID_WIDTH = 96
export const GRID_HEIGHT = 96

// minimum value of the terrain mesh
// since the mesh extends from -0.5 to 0.5, it is set to -0.5 in this case
export const MIN_TERRAIN_VAL = 0.5

// for the tree, the color is chosen based on the name of the material
export const MATERIAL_COLORS_BY_NAME = {
    'trunk': [0.6, 0.3, 0.],
    'leaves': [0, 0.2, 0.15] 
}

// threshold value for the hash for a tree to exist
export const TREE_THRESH = 2030

// threshold value for the hash for a bird to exist
export const BIRD_THRESH = 2035