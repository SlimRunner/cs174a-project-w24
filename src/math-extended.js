import { defs, tiny } from "../examples/common.js";

const {
  Vector,
  Vector3,
  vec,
  vec3,
  vec4,
  Matrix,
  Mat4,
} = tiny;

export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

export function lerp(x, y, t) {
  return (1 - t) * x + t * y;
}

export class Float3 extends Vector3 {
  static create(x, y, z) {
    const v = new Float3(3);
    v[0] = x;
    v[1] = y;
    v[2] = z;
    return v;
  }

  set_v(x, y, z) {
    this[0] = x;
    this[1] = y;
    this[2] = z;
  }

  set_polar_xz(radius, theta) {
    this[0] = radius * Math.cos(theta);
    this[2] = radius * Math.sin(theta);
  }

  set_clamped(x_in, y_in, z_in, dist_low, dist_high) {
    const x_abs = Math.abs(x_in);
    const y_abs = Math.abs(y_in);
    const z_abs = Math.abs(z_in);
  
    if (x_abs < dist_low) x_in = 0;
    if (y_abs < dist_low) y_in = 0;
    if (z_abs < dist_low) z_in = 0;
    if (x_abs > dist_high) x_in = Sgn(x_in) * dist_high;
    if (y_abs > dist_high) y_in = Sgn(y_in) * dist_high;
    if (z_abs > dist_high) z_in = Sgn(z_in) * dist_high;
  
    this[0] = x_in;
    this[1] = y_in;
    this[2] = z_in;
  }

  // assume input is a vector with zero tail
  set_clamped_radial(x_delta, y_delta, z_delta, rad_low, rad_high) {
    const square_sum = Math.hypot(x_delta, y_delta, z_delta);
    
    if (square_sum < rad_low) {
      this[0] = 0;
      this[1] = 0;
      this[2] = 0;
    } else if (square_sum > rad_high) {
      const t_param = rad_high / square_sum;
      this[0] = x_delta * t_param;
      this[1] = y_delta * t_param;
      this[2] = z_delta * t_param;
    } else {
      this[0] = x_delta;
      this[1] = y_delta;
      this[2] = z_delta;
    }
  }
}

export function custom_look_at(eye_loc, at_vec, up_vec) {
  // look_at():  Produce a traditional graphics camera "lookat" matrix.
  // Each input must be a 3x1 Vector.
  // Note:  look_at() assumes the result will be used for a camera and stores its
  // result in inverse space.
  // If you want to use look_at to point a non-camera towards something, you can
  // do so, but to generate the correct basis you must re-invert its result.

  // Compute vectors along the requested coordinate axes. "y" is the "updated" and orthogonalized local y axis.
  let z = at_vec.normalized(),
    x = z.cross(up_vec).normalized(),
    y = x.cross(z).normalized();

  // Check for NaN, indicating a degenerate cross product, which
  // happens if eye == at, or if at minus eye is parallel to up.
  if (!x.every((i) => i == i)) {
    console.log(JSON.stringify({
      eye_loc, at_vec, up_vec
    }))
    throw "Two parallel vectors were given";
  }
  z.scale_by(-1); // Enforce right-handed coordinate system.
  return Mat4.translation(
    -x.dot(eye_loc),
    -y.dot(eye_loc),
    -z.dot(eye_loc)
  ).times(Matrix.of(x.to4(0), y.to4(0), z.to4(0), vec4(0, 0, 0, 1)));
}

export function min_abs(value, max_length) {
  max_length = Math.abs(max_length);

  if (value > max_length) {
    return max_length;
  } else if (value < -max_length) {
    return -max_length;
  } else {
    return value;
  }
}

export function get_icosahedron_vertices() {
  const phi_dist = Math.sqrt(GOLDEN_RATIO * GOLDEN_RATIO + 1);
  const a = 1 / phi_dist;
  const b = GOLDEN_RATIO / phi_dist;

  const vertices = [];

  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      for (let z = 1; z <= 3; z += 1) {
        switch (z) {
          case 1:
            vertices.push(vec3(a * x, 0, b * y));
            break;
          case 2:
            vertices.push(vec3(0, b * x, a * y));
            break;
          case 3:
            vertices.push(vec3(b * x, a * y, 0));
            break;
        }
      }
    }
  }
  console.log(vertices);
  
  const edge_pairs = new Map();
  for (let i = 0; i < vertices.length; i++) {
    for (let j = 0; j < i; j++) {
      let edge_length = Math.hypot(...vertices[j].minus(vertices[i]));
      if (edge_length > 0 && edge_length < 1.1) {
        if (!edge_pairs.has(i)) {
          edge_pairs.set(i, new Set([j]));
        } else {
          edge_pairs.get(i).add(j);
        }
        if (!edge_pairs.has(j)) {
          edge_pairs.set(j, new Set([i]));
        } else {
          edge_pairs.get(j).add(i);
        }
      }
    }
  }
  console.log(edge_pairs);
}
