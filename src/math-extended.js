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

export function transform_vector(mat, vec) {
  if (vec.length === 3) {
    const res = vec3(...vec);
    res[0] = vec[0] * mat[0][0] + vec[1] * mat[0][1] + vec[2] * mat[0][2] + mat[0][3];
    res[1] = vec[0] * mat[1][0] + vec[1] * mat[1][1] + vec[2] * mat[1][2] + mat[1][3];
    res[2] = vec[0] * mat[2][0] + vec[1] * mat[2][1] + vec[2] * mat[2][2] + mat[2][3];
    return res;
  } else {
    res[0] = vec[0] * mat[0][0] + vec[1] * mat[0][1] + vec[2] * mat[0][2] + vec[3] * mat[0][3];
    res[1] = vec[0] * mat[1][0] + vec[1] * mat[1][1] + vec[2] * mat[1][2] + vec[3] * mat[1][3];
    res[2] = vec[0] * mat[2][0] + vec[1] * mat[2][1] + vec[2] * mat[2][2] + vec[3] * mat[2][3];
    res[3] = vec[0] * mat[2][0] + vec[1] * mat[2][1] + vec[2] * mat[2][2] + vec[3] * mat[3][3];
    return res;
  }
}

export function strip_rotation(mat) {
  return Matrix.of(
    [1, 0, 0, mat[0][3]],
    [0, 1, 0, mat[1][3]],
    [0, 0, 1, mat[2][3]],
    [0, 0, 0, 1],
  );
}

class Mat3 extends Matrix {
  // **Mat3** generates special 3x3 matrices that are useful for graphics.
  // All the methods below return a certain 3x3 matrix.
  static identity() {
    return Matrix.of([1, 0, 0], [0, 1, 0], [0, 0, 1]);
  };

  static rotation(angle, x, y, z) {
    // rotation(): Requires a scalar (angle) and a three-component axis vector.
    const normalize = (x, y, z) => {
      const n = Math.sqrt(x * x + y * y + z * z);
      return [x / n, y / n, z / n]
    }
    let [i, j, k] = normalize(x, y, z),
      [c, s] = [Math.cos(angle), Math.sin(angle)],
      omc = 1.0 - c;
    return Matrix.of([i * i * omc + c, i * j * omc - k * s, i * k * omc + j * s],
      [i * j * omc + k * s, j * j * omc + c, j * k * omc - i * s],
      [i * k * omc - j * s, j * k * omc + i * s, k * k * omc + c]);
  }

  static scale(x, y, z) {
    // scale(): Builds and returns a scale matrix using x,y,z.
    return Matrix.of([x, 0, 0],
      [0, y, 0],
      [0, 0, z]);
  }

  static translation(x, y) {
    // translation(): Builds and returns a translation matrix using x,y,z.
    return Matrix.of([1, 0, x],
      [0, 1, y],
      [0, 0, 1]);
  }

  static inverse(m) {
    // inverse(): A 3x3 inverse.  Computing it is slow because of
    // the amount of steps; call fewer times when possible.
    const result = Mat3.identity(), m00 = m[0][0], m01 = m[0][1], m02 = m[0][2],
      m10 = m[1][0], m11 = m[1][1], m12 = m[1][2],
      m20 = m[2][0], m21 = m[2][1], m22 = m[2][2];
    result[0][0] = m11 * m22 - m12 * m21;
    result[0][1] = m02 * m21 - m01 * m22;
    result[0][2] = m01 * m12 - m02 * m11;
    result[1][0] = m12 * m20 - m10 * m22;
    result[1][1] = m00 * m22 - m02 * m20;
    result[1][2] = m02 * m10 - m00 * m12;
    result[2][0] = m10 * m21 - m11 * m20;
    result[2][1] = m01 * m20 - m00 * m21;
    result[2][2] = m00 * m11 - m01 * m10;
    // Divide by determinant and return.
    return result.times(1 / (m00 * result[0][0] + m10 * result[0][1] + m20 * result[0][2]));
  }
}
