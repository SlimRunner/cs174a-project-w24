import { defs, tiny } from "../examples/common.js";

const {
  Vector,
  Vector3,
  vec3,
  vec,
  Shape,
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
}
