import { defs, tiny } from "../examples/common.js";
import { get_square_face, enum_axis } from "./utilities.js";

const {
  Vector,
  Vector3,
  vec3,
  vec,
  Shape,
  Mat4,
} = tiny;

// this square is flat instead of vertical
export class Square extends Shape {
  // **Square** demonstrates two triangles that share vertices.  On any planar surface, the
  // interior edges don't make any important seams.  In these cases there's no reason not
  // to re-use data of the common vertices between triangles.  This makes all the vertex
  // arrays (position, normals, etc) smaller and more cache friendly.
  constructor() {
    super("position", "normal", "texture_coord");
    // Specify the 4 square corner locations, and match those up with normal vectors:
    this.arrays.position = Vector3.cast(
      [-1, 0, -1],
      [1, 0, -1],
      [-1, 0, 1],
      [1, 0, 1]
    );
    this.arrays.normal = Vector3.cast(
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0]
    );
    // Arrange the vertices into a square shape in texture space too:
    this.arrays.texture_coord = Vector.cast([0, 0], [1, 0], [0, 1], [1, 1]);
    // Use two triangles this time, indexing into four distinct vertices:
    this.indices.push(0, 1, 2, 1, 3, 2);

    this.xScale = 1.0;
    this.zScale = 1.0;
  }
}

export class Lake_Mesh extends Shape {
  constructor({
    subdivisions = 40,
    phase = 1.88,
  } = {}) {
    super("position", "normal", "texture_coord");

    // https://www.desmos.com/calculator/jdyl5xpkbs

    const TAU = Math.PI * 2;
    const displacement_function = (x, theta) => {
      return (
        0.1  * Math.sin( 3 * TAU * (x +     theta)) +
        0.04 * Math.sin(18 * TAU * (x + 2 * theta)) +
        0.1  * Math.sin( 7 * TAU * (x + 3 * theta)) + 1
      );
    }
    
    this.arrays.position = [vec3(0, 0, 0)];
    this.arrays.normal = [vec3(0, 1, 0)]; // y-up
    this.arrays.texture_coord = [Vector.create(0, 0)];
    
    for (let i = 0; i <= subdivisions; ++i) {
      const alpha = i / subdivisions
      const theta = TAU * alpha;
      const r_delta = displacement_function(alpha, phase);

      const x = Math.cos(theta) * r_delta;
      const z = Math.sin(theta) * r_delta;

      this.arrays.position.push(vec3(x, 0, z));
      this.arrays.normal.push(vec3(0, 1, 0));
      this.arrays.texture_coord.push(Vector.create(x, z));
    }
    
    // be careful with the indices
    // this is a triangle fan, so the first index is always 0
    // also subdivisions + 1 is the last index
    for (let i = 1; i <= subdivisions; ++i) {
      this.indices.push(0, i, i + 1);
    }
  }

  setScale(transform){
    this.xScale = transform[0][0];
    this.zScale = transform[2][2];
  }
  
  isInside(x, z){
    let counter = 0;
    for (let i = 1; i < this.arrays.position.length-1; i++) {
      let edgep1x = this.arrays.position[i][0]*this.xScale;
      let edgep1z = this.arrays.position[i][2]*this.zScale;
      let edgep2x = this.arrays.position[i+1][0]*this.xScale;
      let edgep2z = this.arrays.position[i+1][2]*this.zScale;
      if (((z < edgep1z) != (z < edgep2z)) && (x < edgep1x + ((z-edgep1z)/(edgep2z-edgep1z))*(edgep2x-edgep1x))){
        counter += 1;
      }
    }
    return (counter%2)===1;
  }
}

export class Maze_Walls extends Shape {
  constructor(grid, model_matrix, height_ratio = 1) {
    super("position", "normal", "texture_coord");
    
    const grid_size_x = grid[0].length;
    const grid_size_z = grid.length;

    this.arrays.position = [];
    this.arrays.normal = [];
    this.arrays.texture_coord = [];
    this.indices = [];

    let new_tile = null;
    for (let z = 0; z < grid_size_z; ++z) {
      for (let x = 0; x < grid_size_x; ++x) {
        [
          {
            pos: {x: 0, z: 0},
            axis: enum_axis.y,
            location: vec3(x, 0.5, z),
            side_length: 1,
            positive_normal: true, // looks to +y
          },
          {
            pos: {x: 1, z: 0},
            axis: enum_axis.x,
            location: vec3(x + 0.5, 0, z),
            side_length: 1,
            positive_normal: true, // looks to +x
          },
          {
            pos: {x: -1, z: 0},
            axis: enum_axis.x,
            location: vec3(x - 0.5, 0, z),
            side_length: 1,
            positive_normal: false, // looks to -x
          },
          {
            pos: {x: 0, z: 1},
            axis: enum_axis.z,
            location: vec3(x, 0, z + 0.5),
            side_length: 1,
            positive_normal: true, // looks to +z
          },
          {
            pos: {x: 0, z: -1},
            axis: enum_axis.z,
            location: vec3(x, 0, z - 0.5),
            side_length: 1,
            positive_normal: false, // looks to -z
          },
        ].forEach(square => {
          const {pos, ...props} = square;

          if (
            props.axis === enum_axis.y && !grid[z][x] ||
            0 <= x + pos.x && x + pos.x < grid_size_x &&
            0 <= z + pos.z && z + pos.z < grid_size_z &&
            !grid[z][x] && grid[z + pos.z][x + pos.x]
          ) {
            new_tile = get_square_face({
              ...props,
              index_shift: this.arrays.position.length,
            });
  
            this.arrays.position.push(...new_tile.position);
            this.arrays.normal.push(...new_tile.normal);
            this.indices.push(...new_tile.indices);

            switch (props.axis) {
              case enum_axis.x:
                new_tile.texture_coord.forEach((v, i, a) => {
                  v[1] *= height_ratio;
                });
                break;
              case enum_axis.y:
                // uv coords are coorect as-is
                break;
              case enum_axis.z:
                new_tile.texture_coord.forEach((v, i, a) => {
                  v[0] *= height_ratio;
                });
                break;
              default:
                break;
            }
            
            this.arrays.texture_coord.push(...new_tile.texture_coord);
          }
        });
      }
    }

    const norm_scalar = 1 / Math.max(grid_size_x, grid_size_z);
    const norm_matrix = Mat4.translation(0.5, 0.5, 0.5);
    norm_matrix.pre_multiply(Mat4.scale(norm_scalar, height_ratio * norm_scalar, norm_scalar));
    norm_matrix.pre_multiply(Mat4.translation(-0.5, 0, -0.5));
    norm_matrix.pre_multiply(model_matrix);

    this.arrays.position.forEach((v, i, a) => {
      a[i] = norm_matrix.times(v.to4(1)).to3();
    });
  }

}

export class Maze_Tiles extends Shape {
  constructor(grid, model_matrix, height_ratio = 1) {
    super("position", "normal", "texture_coord");
    
    const grid_size_x = grid[0].length;
    const grid_size_z = grid.length;

    this.arrays.position = [];
    this.arrays.normal = [];
    this.arrays.texture_coord = [];
    this.indices = [];

    let new_tile = null;
    for (let z = 0; z < grid_size_z; ++z) {
      for (let x = 0; x < grid_size_x; ++x) {
        [
          {
            pos: {x: 0, z: 0},
            axis: enum_axis.y,
            location: vec3(x, -0.5, z),
            side_length: 1,
            positive_normal: true, // looks to +y
          },
        ].forEach(square => {
          const {pos, ...props} = square;

          if (grid[z][x] ) {
            new_tile = get_square_face({
              ...props,
              index_shift: this.arrays.position.length,
            });
  
            this.arrays.position.push(...new_tile.position);
            this.arrays.normal.push(...new_tile.normal);
            this.indices.push(...new_tile.indices);
            this.arrays.texture_coord.push(...new_tile.texture_coord);
          }
        });
      }
    }

    const norm_scalar = 1 / Math.max(grid_size_x, grid_size_z);
    const norm_matrix = Mat4.translation(0.5, 0.5, 0.5);
    norm_matrix.pre_multiply(Mat4.scale(norm_scalar, height_ratio * norm_scalar, norm_scalar));
    norm_matrix.pre_multiply(Mat4.translation(-0.5, 0, -0.5));
    norm_matrix.pre_multiply(model_matrix);

    this.arrays.position.forEach((v, i, a) => {
      a[i] = norm_matrix.times(v.to4(1)).to3();
    });
  }

}
