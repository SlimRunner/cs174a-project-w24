import { defs, tiny } from "../examples/common.js";

const {
  vec3, vec4, Mat4, Vector3
} = tiny;

// helper generator to get a iteratable ranges
export function* range(start, end, step = 1, offset = 0) {
  if (start === end) {
      yield start;
      return;
  }
  step = Math.abs(step);
  const mod = (n, m) => {
      const rem = n % m;
      return n * m >= 0 ? rem : rem ? rem + m : 0;
  };
  let i = start;
  let n = mod(offset, step);
  let s = Math.sign(end - start);
  if (i % step !== n) {
      i += s >= 0 ? step - mod(i - n, step) : -mod(i - n, step);
      if (!(s >= 0 ? i <= end : i >= end)) return;
  }
  while (s >= 0 ? i <= end : i >= end) {
      yield i;
      i += s * step;
  }
}

// does not include end
export function rand_int(start, size) {
  return Math.floor(Math.random() * size) + start;
}

export function find_ray_triag_crossing(point, dir, a, b, c) {
  // https://courses.cs.washington.edu/courses/csep557/10au/lectures/triangle_intersection.pdf
  point = vec3(point[0], point[1], point[2]);
  dir = vec3(dir[0], dir[1], dir[2]);
  a = vec3(a[0], a[1], a[2]);
  b = vec3(b[0], b[1], b[2]);
  c = vec3(c[0], c[1], c[2]);
  let q = vec3(0,0,0);

  const ba = b.minus(a);
  const cb = c.minus(b);
  const ac = a.minus(c);
  const ca = c.minus(a);

  let norm = ba.cross(ca);
  norm.normalize();

  const ND = norm.dot(dir);
  if (ND === 0) {
    return null;
  }
  const t = dir.norm() * norm.dot(a.minus(point)) / ND;
  q = point.plus(dir.times(t));

  if (
    ba.cross(q.minus(a)).dot(norm) >=0 &&
    cb.cross(q.minus(b)).dot(norm) >=0 &&
    ac.cross(q.minus(c)).dot(norm) >=0 &&
    0 <= t
  ) {
    return q;
  }

  return null;
}

export function check_scene_intersection(pos, dir, meshes) {
  let closest_crossing = null, mesh_cross = null, mesh_index = null;
  let triag = null, triag_index = null, min_dist = Infinity;

  // these variables are declared here to avoid declaration in loop
  let crossing = null, cross_dist = null;
  let pos_alias = null, mdl_alias = null, idx_alias = null;
  let triag_vtx = null;

  for (const [msh_idx, mesh] of meshes.entries()) {
    for (let i = 0; i < mesh.object.indices.length; i += 3) {
      pos_alias = mesh.object.arrays.position;
      mdl_alias = mesh.model_transform;
      idx_alias = mesh.object.indices;

      // transform point to world space
      triag_vtx = [
        mdl_alias.times(vec4(...pos_alias[idx_alias[i]], 1)),
        mdl_alias.times(vec4(...pos_alias[idx_alias[i + 1]], 1)),
        mdl_alias.times(vec4(...pos_alias[idx_alias[i + 2]], 1)),
      ]

      crossing = find_ray_triag_crossing(
        pos, dir,
        triag_vtx[0],
        triag_vtx[1],
        triag_vtx[2]
      );

      if (crossing /* exists */) {
        cross_dist = crossing.minus(pos).norm();
        if (cross_dist < min_dist) {
          closest_crossing = crossing;
          triag = triag_vtx;
          mesh_cross = mesh;
          min_dist = cross_dist;
          triag_index = i;
          mesh_index = msh_idx;
        }
      }
    }
  }

  triag = triag?.map(v => vec3(v[0], v[1], v[2])) ?? null;
  const normal = triag ? triag[1].minus(triag[0]).cross(triag[2].minus(1)): 0;

  return {
    mesh: mesh_cross,
    point: closest_crossing,
    distance: min_dist,
    normal: normal,
    triag_index: triag_index,
    mesh_index: mesh_index,
  }
}

// Implemented with the visual help of Desmos
// https://www.desmos.com/calculator/mzhbhtmfjc
export function make_maze(size_x, size_y, cutout_radius = 0) {
  // size expresses the size of generation cells not actual size, For
  // example, a 1x1 turns into a 3x3 because that's how many neigboring
  // cells you need for the backtracking algorithm to work. similarly if
  // you give a 2x2 you get a 5x5, and so on.
  size_x = 2 * size_x + 1;
  size_y = 2 * size_y + 1;

  const grid = [];

  for (const y of range(0, size_y - 1)) {
    const row = [];
    grid.push(row);
    for (const x of range(0, size_x - 1)) {
      row.push(0);
    }
  }

  // guarantees to get a valid random node in the grid
  const get_odd_rand = (t_max) => {
    const t = rand_int(0, t_max);
    return 1 + 2 * Math.floor(Math.min(t, t_max - 2) * 0.5);
  };
  
  const get_neighbors = (x_max, y_max, h, g) => {
    // note the neighbors are always 2 units away
    return [
      { x: 2 + h.x, y: 0 + h.y },
      { x: 0 + h.x, y: 2 + h.y },
      { x: -2 + h.x, y: 0 + h.y },
      { x: 0 + h.x, y: -2 + h.y },
    ].filter(v => {
      return (
        0 <= v.x && v.x < x_max &&
        0 <= v.y && v.y < y_max &&
        !g[v.y][v.x]
      );
    });
  };

  const stack = [{
    x: get_odd_rand(size_x),
    y: get_odd_rand(size_y),
  }];
  
  let here = stack[0];

  // This is not regular DFS; instead, the stack keeps growing so long
  // as you can move to a neighboring cell non-visited cell. Once you
  // can no longer do that, then you start backtracking using the stack.
  // Then the code does that until it can move to a non-visited neighbor
  // again. The algorithm finishes once the stack is empty.
  while (stack.length) {
    grid[here.y][here.x] = 1;
    const neighbors = get_neighbors(size_x, size_y, here, grid);
    if (neighbors.length) {
      const next = neighbors[rand_int(0, neighbors.length)];
      const x_mid = (next.x + here.x) / 2;
      const y_mid = (next.y + here.y) / 2;
      grid[y_mid][x_mid] = 1;
      here = next;
      stack.push(next);
    } else {
      here = stack.pop();
    }
  }

  if (cutout_radius > 0) {
    --cutout_radius;
    const smallest_side = Math.min(size_x, size_y);
    cutout_radius = Math.min(
      cutout_radius,
      (smallest_side - 1) / 2
    );
    const x_mid = (size_x - 1) / 2;
    const y_mid = (size_y - 1) / 2;
    for (const y of range(y_mid - cutout_radius, y_mid + cutout_radius)) {
      for (const x of range(x_mid - cutout_radius, x_mid + cutout_radius)) {
        grid[y][x] = 1;
      }
    }
  }

  return grid;
}

export function pretty_print_grid(grid) {
  let msg = "";
  for (const y of grid) {
    for (const x of y) {
      msg += x ? "  " : "██";
    }
    msg += "\n";
  }
  console.log(msg);
}
