// Extended Window interface for p5play and ml5 globals
export interface CustomWindow extends Window {
  p5: any;
  ml5: any;
  planck: any;
  Sprite: any;
  Group: any;
  GlueJoint: any;
  HingeJoint: any;
  world: any;
}

export interface Keypoint {
  x: number;
  y: number;
  name?: string;
}

export interface Hand {
  keypoints: Keypoint[];
  handedness: 'Left' | 'Right';
  score: number;
}
