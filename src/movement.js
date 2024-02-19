import { defs, tiny } from "../examples/common.js";
import { Float3, custom_look_at, min_abs } from "./math-extended.js";

const {
  Vector,
  Vector3,
  vec,
  vec3,
  vec4,
  Matrix,
  Mat4,
  Scene,
} = tiny;

export class Walk_Movement extends Scene {
  constructor() {
    super();

    // this is slightly more verbose than the style used by
    // tiny-graphics, but it does not destroy intellisense by
    // unecessary levels of indirection.

    this.thrust = 0;
    this.speed = 0;
    this.position = Float3.create(0, 0, 0);
    this.torque = 0
    this.angular_speed = 0;
    this.direction = 0;
    this.dir_flag = 0;
    this.compass = Vector3.create(0, 0, 0);
    this.up_axis = Vector3.create(0, 1, 0);
    this.walk_force = 22.0;
    this.turning_force = 9.28;
    this.speed_limit = 30;
    this.turn_speed_limit = 3.0;
    this.speed_decay_factor = 0.8;
    this.angular_decay_factor = 0.3;

    this.gravity = -40;
    this.min_height = 1.5;
    this.jump_thrust = 0;
    this.fall_speed = 0;
    this.height = this.min_height;
    this.jumping_force = 700;

    this.consts = Object.freeze({
      cardinal_dir: Object.freeze({
        N: 1,
        W: 2,
        S: 4,
        E: 8,
        NW: 1 | 2,
        NE: 1 | 8,
        SW: 4 | 2,
        SE: 4 | 8,
        ALL: 1 | 2 | 4 | 8,
      }),
    });
  }

  set_recipient(matrix_closure, inverse_closure, camera) {
    // set_recipient(): The camera matrix is not actually stored here inside Movement_Controls;
    // instead, track an external target matrix to modify.  Targets must be pointer references
    // made using closures.
    this.matrix = matrix_closure;
    this.inverse = inverse_closure;
    this.camera = camera;
  }

  reset(graphics_state) {
    // reset(): Initially, the default target is the camera matrix that Shaders use, stored in the
    // encountered program_state object.  Targets must be pointer references made using closures.
    this.set_recipient(
      () => graphics_state.camera_transform,
      () => graphics_state.camera_inverse,
      () => graphics_state
    );
  }

  make_control_panel() {
    // make_control_panel(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.

    const dir = this.consts.cardinal_dir;

    this.control_panel.innerHTML += "Click WASD to move around";
    this.live_string(
      (box) =>
        (box.textContent =
          "- Position: " +
          this.position[0].toFixed(2) +
          ", " +
          this.position[1].toFixed(2) +
          ", " +
          this.position[2].toFixed(2))
    );
    this.new_line();
    // The facing directions are surprisingly affected by the left hand rule:
    this.live_string(
      (box) =>
        (box.textContent =
          "- Facing: " +
          ((this.compass[0] > 0 ? "West " : "East ") +
            (this.compass[1] > 0 ? "Down " : "Up ") +
            (this.compass[2] > 0 ? "North" : "South")))
    );
    this.new_line();
    this.new_line();

    this.key_triggered_button(
      "Jump",
      [" "],
      () => (this.jump_thrust = this.height <= this.min_height ? this.jumping_force : 0)
    );
    this.key_triggered_button(
      "Forward",
      ["w"],
      () => {
        this.dir_flag |= dir.N;
      },
      undefined,
      () => (this.dir_flag &= dir.ALL ^ dir.N)
    );
    this.new_line();
    this.key_triggered_button(
      "Left",
      ["a"],
      () => {
        this.dir_flag |= dir.W;
      },
      undefined,
      () => (this.dir_flag &= dir.ALL ^ dir.W)
    );
    this.key_triggered_button(
      "Back",
      ["s"],
      () => {
        this.dir_flag |= dir.S;
      },
      undefined,
      () => (this.dir_flag &= dir.ALL ^ dir.S)
    );
    this.key_triggered_button(
      "Right",
      ["d"],
      () => {
        this.dir_flag |= dir.E;
      },
      undefined,
      () => (this.dir_flag &= dir.ALL ^ dir.E)
    );
    this.new_line();
  }

  walk(state, dt) {
    const dir = this.consts.cardinal_dir;
    const thrustforce = this.walk_force;
    const torqueforce = this.turning_force;
    this.thrust = 0;
    this.torque = 0;

    if (this.dir_flag & dir.N) {
      this.thrust += thrustforce;
    }
    if (this.dir_flag & dir.S) {
      this.thrust += -thrustforce;
    }
    if (this.dir_flag & dir.W) {
      this.torque += -torqueforce;
    }
    if (this.dir_flag & dir.E) {
      this.torque += torqueforce;
    }

    const heading = Vector3.create(Math.cos(this.direction), 0, Math.sin(this.direction));
    const airborne = this.height > this.min_height;

    if (!airborne && this.jump_thrust == 0) {
      this.fall_speed = 0;
    } else {
      this.fall_speed += (this.jump_thrust + this.gravity) * dt;
      this.jump_thrust = 0;
      this.height = Math.max(this.height + this.fall_speed * dt, this.min_height);
    }

    this.angular_speed = min_abs(this.angular_speed + this.torque * dt, this.turn_speed_limit);
    if (!(this.dir_flag & (dir.W | dir.E))) {
      this.angular_speed *= this.angular_decay_factor;
    }
    this.direction += this.angular_speed * dt;

    this.speed = min_abs(this.speed + this.thrust * dt, this.speed_limit);
    if (!(this.dir_flag & (dir.N | dir.S)) && !airborne) {
      this.speed *= this.speed_decay_factor;
    }
    this.position.add_by(heading.times(this.speed * dt));
    this.position[1] = this.height;

    state.set_camera(custom_look_at(this.position, heading, this.up_axis));
  }

  display(
    context,
    graphics_state,
    dt = graphics_state.animation_delta_time / 1000
  ) {
    if (!this.setup_once) {
      this.reset(graphics_state);
      this.setup_once = true;
    }

    this.walk(graphics_state, dt);

    this.compass = this.inverse().times(vec4(0, 0, 1, 0));
  }
}