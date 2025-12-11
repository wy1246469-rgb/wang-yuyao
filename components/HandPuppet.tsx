import React, { useEffect, useRef, useState } from 'react';
import { CustomWindow, Hand, Keypoint } from '../types';
import { playFaceChangeSound, playDropSound, updateMovementSound, stopMovementSound, resumeAudio, playFartSound } from '../utils/sound';

declare const window: CustomWindow;

// Special items requested by user
const SPECIAL_EMOJIS = [
  "🐶", "🐱", "🐭", "🐹", "🐰", // 5 Animals
  "💩", "🚽", "🖕", "🫧" // Poop, Toilet, Middle Finger, Bubble (New Capsule Mimic)
];

// Emoji list for the sidebar
const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
  "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
  "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
  "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
  "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
  "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
  "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦"
];

const HandPuppet: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  // Capsule Size State
  const [capsuleWidth, setCapsuleWidth] = useState(580);
  const [capsuleHeight, setCapsuleHeight] = useState(420);

  // Function to change the face (called from React UI)
  const handleFaceChange = (emoji: string) => {
    resumeAudio();
    playFaceChangeSound();
    if (p5InstanceRef.current && p5InstanceRef.current.setPuppetFace) {
      p5InstanceRef.current.setPuppetFace(emoji);
    }
  };

  // Handle resizing the capsule
  const handleResize = (dim: 'w' | 'h', val: number) => {
    if (dim === 'w') setCapsuleWidth(val);
    if (dim === 'h') setCapsuleHeight(val);
    
    if (p5InstanceRef.current && p5InstanceRef.current.updateCapsuleSize) {
       // We pass the new values directly, relying on state for the UI only
       const newW = dim === 'w' ? val : capsuleWidth;
       const newH = dim === 'h' ? val : capsuleHeight;
       p5InstanceRef.current.updateCapsuleSize(newW, newH);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, emoji: string) => {
    e.dataTransfer.setData("text/plain", emoji);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    resumeAudio();
    const emoji = e.dataTransfer.getData("text/plain");
    
    if (p5InstanceRef.current && p5InstanceRef.current.spawnEmoji && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasWidth = 640; // Internal resolution
      const canvasHeight = 480;
      
      // Calculate coordinates relative to the canvas internal resolution
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      p5InstanceRef.current.spawnEmoji(x, y, emoji);
      playDropSound();
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import p5 logic to ensure window globals are ready
    const sketch = (p: any) => {
      let handpose: any;
      let video: any;
      let hands: Hand[] = [];
      let prevHandX = 0;
      let prevHandY = 0;
      
      // Puppet parts
      let pieces: any;
      let emojisGroup: any;
      let bubblesGroup: any; // For the new capsule-like bubbles
      let head: any, shoulders: any, neck: any;
      let leftUpperArm: any, leftLowerArm: any, rightUpperArm: any, rightLowerArm: any;
      let torso: any, hips: any;
      let leftThigh: any, leftLowerLeg: any, leftFoot: any;
      let rightThigh: any, rightLowerLeg: any, rightFoot: any;
      
      let boundary: any;
      
      // Dynamic boundary dimensions
      let currentCapW = 580;
      let currentCapH = 420;

      // Joints/Hinges (references for physics)
      let shoulderHingeA: any, shoulderHingeB: any, shoulderHingeC: any, shoulderHingeD: any;
      let leftElbowHingeA: any, leftElbowHingeB: any, rightElbowHingeA: any, rightElbowHingeB: any;
      let leftHipHingeA: any, leftHipHingeB: any, rightHipHingeA: any, rightHipHingeB: any;
      let leftKneeHingeA: any, leftKneeHingeB: any, rightKneeHingeA: any, rightKneeHingeB: any;

      const options = { maxHands: 2, flipHorizontal: true, runtime: "mediapipe" };
      const xMax = 640;
      const yMax = 480;
      let whichHand: 'Left' | 'Right' | undefined;
      const pScale = 0.5;
      const yGap = 150;

      // Exposed methods for React
      p.setPuppetFace = (emoji: string) => {
        if (head) {
          head.img = emoji; 
        }
      };

      p.updateCapsuleSize = (w: number, h: number) => {
         currentCapW = w;
         currentCapH = h;
         makeCapsuleBoundary();
      };

      p.spawnEmoji = (x: number, y: number, emoji: string) => {
        if (!emojisGroup) return;

        // Special handling for the Bubble Capsule
        if (emoji === "🫧") {
           const size = 80;
           const bubble = new bubblesGroup.Sprite(x, y, size);
           bubble.capturedItems = []; // Array to store trapped textures
           bubble.bounciness = 0.9; // Very bouncy
           bubble.friction = 0.1;
           bubble.mass = 2;
           // Custom drawing for the bubble to look like the main capsule
           bubble.draw = () => {
              // Glassy look
              p.noFill();
              p.strokeWeight(3);
              p.stroke(100, 200, 255, 150);
              p.fill(255, 255, 255, 30);
              p.circle(0, 0, bubble.diameter);
              
              // Shine
              p.noStroke();
              p.fill(255, 200);
              p.circle(bubble.diameter * 0.25, -bubble.diameter * 0.25, bubble.diameter * 0.2);

              // Draw captured items
              if (bubble.capturedItems && bubble.capturedItems.length > 0) {
                 const len = bubble.capturedItems.length;
                 // Arrange them in a tiny circle or grid inside
                 for(let i=0; i<len; i++) {
                    p.push();
                    const offsetAngle = (p.frameCount * 0.05) + (i * (Math.PI * 2 / len));
                    const dist = bubble.diameter * 0.15;
                    const bx = Math.cos(offsetAngle) * dist;
                    const by = Math.sin(offsetAngle) * dist;
                    p.translate(bx, by);
                    // Draw text or image. Since we stored the 'emoji' string or image
                    // We need to handle it. If we pushed the texture, we use image()
                    // If we pushed string, text(). 
                    // p5play sprites .img property converts text to an image.
                    // So we will store the p5.Image object.
                    p.imageMode(p.CENTER);
                    p.scale(0.4); // Shrink captured items
                    if (bubble.capturedItems[i]) {
                       p.image(bubble.capturedItems[i], 0, 0);
                    }
                    p.pop();
                 }
              }
           };
           return;
        }

        // Standard Emoji
        const size = (Math.random() * 30 + 30); // Random size 30-60
        const emojiSprite = new emojisGroup.Sprite(x, y, size);
        emojiSprite.img = emoji;
        emojiSprite.shape = 'circle';
        emojiSprite.fartCount = 0; 
      };

      p.preload = () => {
        setStatus('Loading HandPose Model...');
        if (window.ml5) {
          handpose = window.ml5.handPose(options);
        }
      };

      p.setup = () => {
        setStatus('Setting up simulation...');
        const canvas = p.createCanvas(xMax, yMax);
        
        if (p.world) {
           p.world.gravity.y = 20;
        }

        video = p.createCapture(p.VIDEO);
        video.size(xMax, yMax);
        video.hide();

        if (handpose) {
          handpose.detectStart(video, gotHands);
          setStatus('Detecting Hands...');
        }

        // Initialize Physics Groups
        if (p.Group) {
            pieces = new p.Group();
            pieces.color = 'white';
            pieces.overlaps(pieces); 
            pieces.stroke = 'white';
            pieces.drag = 1;
            
            emojisGroup = new p.Group();
            emojisGroup.bounciness = 0.6;
            emojisGroup.friction = 0.5;

            bubblesGroup = new p.Group();
            bubblesGroup.bounciness = 0.9;
            bubblesGroup.friction = 0;
            
            makePuppet();
            makeCapsuleBoundary();
            
            // Helper to play sound if count < 1 (Only one fart!)
            const tryPlayFart = (sprite: any) => {
                if (sprite.fartCount === undefined) sprite.fartCount = 0;
                if (sprite.fartCount < 1) {
                    playFartSound();
                    sprite.fartCount++;
                }
            };

            // Collisions
            if (boundary) {
               emojisGroup.collides(boundary, (emoji: any) => { tryPlayFart(emoji); return true; });
               bubblesGroup.collides(boundary);
            }
            if (pieces) {
               emojisGroup.collides(pieces, (emoji: any) => { tryPlayFart(emoji); return true; });
               bubblesGroup.collides(pieces); // Bubbles bounce off puppet
            }
            
            emojisGroup.collides(emojisGroup, (emojiA: any, emojiB: any) => {
                  tryPlayFart(emojiA);
                  tryPlayFart(emojiB);
                  return true;
            });

            // BUBBLE CAPTURE MECHANIC
            // When a bubble hits an emoji
            bubblesGroup.collides(emojisGroup, (bubble: any, emoji: any) => {
                // Initialize array if missing
                if (!bubble.capturedItems) bubble.capturedItems = [];
                
                // Max capacity 4
                if (bubble.capturedItems.length < 4) {
                   // Capture the texture
                   // p5play v3 sprites have an .image property which is the p5.Image
                   // .img is the alias often used.
                   if (emoji.image) {
                      bubble.capturedItems.push(emoji.image);
                   }
                   
                   // Remove the victim from the world
                   emoji.remove();
                   
                   // Grow slightly to indicate fullness
                   bubble.diameter += 5;
                   
                   // Satisfying pop sound (using drop sound for now)
                   playDropSound();
                } else {
                   // Bounce off if full
                   return true;
                }
            });
            
            // Bubbles bounce off each other
            bubblesGroup.collides(bubblesGroup);

        } else {
            console.error("p5play Group not found on p5 instance.");
            setStatus("Error: p5play not loaded properly");
        }
      };

      p.draw = () => {
        p.background('#1f2937'); // Match bg-gray-800
        
        showVideo();
        
        // Draw the gradient boundary manually before the sprites
        drawGradientBoundary();
        
        // Draw reflection after boundary (on top)
        drawGlassReflection();
        
        getHandedness();
        movePuppet();
        correctJointAngles();
      };

      function drawGradientBoundary() {
        const cx = xMax / 2;
        const cy = yMax / 2;
        const w = currentCapW;
        const h = currentCapH;
        // Radius cannot be larger than half the smallest dimension to preserve capsule shape logic
        const r = Math.min(h / 2, w / 2); 
        const straightLen = Math.max(0, w - 2 * r);
        const straightHalf = straightLen / 2;
        
        const thickness = 60; 
        
        p.push();
        p.noFill();
        
        for (let i = 0; i < thickness; i += 1) {
            const t = i / thickness; 
            const alpha = 180 * Math.pow(1 - t, 2); 
            
            if (i < 2) {
               p.stroke(255, 255, 255, 200); 
            } else {
               p.stroke(56, 189, 248, alpha); 
            }
            
            p.strokeWeight(1.5); 
            
            const currentR = r - i;
            if (currentR < 0) break;

            p.beginShape();
            // Top Right start
            p.vertex(cx + straightHalf, cy - currentR);
            // Right Arc
            for (let a = -Math.PI/2; a <= Math.PI/2; a += 0.2) {
                p.vertex(cx + straightHalf + currentR * Math.cos(a), cy + currentR * Math.sin(a));
            }
            // Bottom Left start
            p.vertex(cx - straightHalf, cy + currentR);
            // Left Arc
            for (let a = Math.PI/2; a <= 3 * Math.PI/2; a += 0.2) {
                p.vertex(cx - straightHalf + currentR * Math.cos(a), cy + currentR * Math.sin(a));
            }
            p.endShape(p.CLOSE);
        }
        p.pop();
      }

      function drawGlassReflection() {
          const cx = xMax / 2;
          const cy = yMax / 2;
          const w = currentCapW;
          const h = currentCapH;
          const r = Math.min(h / 2, w / 2);
          const straightLen = Math.max(0, w - 2 * r);
          
          const inset = 20; 
          const reflectR = Math.max(10, r - inset);

          p.push();
          p.noFill();
          p.strokeWeight(12);
          p.strokeCap(p.ROUND);
          
          if (p.drawingContext) {
              const ctx = p.drawingContext;
              const grad = ctx.createLinearGradient(cx - straightLen/2 - reflectR, cy - reflectR, cx, cy);
              grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
              grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
              ctx.strokeStyle = grad;
          } else {
              p.stroke(255, 100);
          }

          p.beginShape();
          const startAngle = Math.PI + 0.4;
          const endAngle = Math.PI * 1.5 - 0.2;
          for (let a = startAngle; a <= endAngle; a += 0.1) {
              const px = (cx - straightLen/2) + reflectR * Math.cos(a);
              const py = cy + reflectR * Math.sin(a);
              p.vertex(px, py);
          }
          p.endShape();
          
          p.stroke(255, 200);
          p.strokeWeight(6);
          const specX = (cx - straightLen/2) + reflectR * Math.cos(Math.PI + 0.8);
          const specY = cy + reflectR * Math.sin(Math.PI + 0.8);
          p.point(specX, specY);

          p.pop();
      }

      function gotHands(results: any) {
        hands = results;
      }

      function showVideo() {
        p.push();
        if (options.flipHorizontal){
            p.translate(p.width, 0); 
            p.scale(-1, 1);
        }
        let transparency = 50; 
        p.tint(255, 255, 255, transparency); 
        p.image(video, 0, 0, p.width, p.height);
        p.pop();
      }

      function getHandedness() {
        for (let i = 0; i < hands.length; i++) {
            let hand = hands[i];
            whichHand = hand.handedness;
        }
      }

      function movePuppet() {
        p.strokeWeight(2);
        p.stroke(255, 100); 
        
        let targetX = 0;
        let targetY = 0;
        let isTracking = false;

        if (hands.length > 0 && head) {
            let jointToTrack: Keypoint;
            jointToTrack = hands[0].keypoints[12];
            targetX = jointToTrack.x;
            targetY = jointToTrack.y;
            isTracking = true;

            head.moveTowards(jointToTrack.x, jointToTrack.y + yGap, 0.5);
            p.line(head.x, head.y, jointToTrack.x, jointToTrack.y);

            if (whichHand === 'Left') { jointToTrack = hands[0].keypoints[16]; } else { jointToTrack = hands[0].keypoints[8]; }
            if (leftLowerArm) {
                leftLowerArm.moveTowards(jointToTrack.x, jointToTrack.y + yGap, 0.5);
                p.line(leftLowerArm.x, leftLowerArm.y, jointToTrack.x, jointToTrack.y);
            }

            if (whichHand === 'Left') { jointToTrack = hands[0].keypoints[8]; } else { jointToTrack = hands[0].keypoints[16]; }
            if (rightLowerArm) {
                rightLowerArm.moveTowards(jointToTrack.x, jointToTrack.y + yGap, 0.5);
                p.line(rightLowerArm.x, rightLowerArm.y, jointToTrack.x, jointToTrack.y);
            }

            if (whichHand === 'Left') { jointToTrack = hands[0].keypoints[20]; } else { jointToTrack = hands[0].keypoints[4]; }
            if (leftKneeHingeB) {
                leftKneeHingeB.moveTowards(jointToTrack.x, jointToTrack.y + yGap + 200 * pScale, 1);
                p.line(leftKneeHingeB.x, leftKneeHingeB.y, jointToTrack.x, jointToTrack.y);
            }

            if (whichHand === 'Right') { jointToTrack = hands[0].keypoints[20]; } else { jointToTrack = hands[0].keypoints[4]; }
            if (rightKneeHingeB) {
                rightKneeHingeB.moveTowards(jointToTrack.x, jointToTrack.y + yGap + 200 * pScale, 1);
                p.line(rightKneeHingeB.x, rightKneeHingeB.y, jointToTrack.x, jointToTrack.y);
            }
        }
        
        if (isTracking) {
          const speed = p.dist(targetX, targetY, prevHandX, prevHandY);
          updateMovementSound(speed);
          prevHandX = targetX;
          prevHandY = targetY;
        } else {
          updateMovementSound(0);
        }
      }

      function correctJointAngles() {
        if (!leftThigh || !leftLowerLeg || !rightThigh || !rightLowerLeg || !leftLowerArm || !leftUpperArm || !rightUpperArm || !rightLowerArm) return;

        let lLegBendAngle = Math.round( (((leftThigh.rotation - leftLowerLeg.rotation) % 360) + 360) % 360 );
        if (lLegBendAngle > 180) { leftLowerLeg.rotate(-5, 30); }
        
        let rLegBendAngle = Math.round( (((rightLowerLeg.rotation - rightThigh.rotation) % 360) + 360) % 360 );
        if (rLegBendAngle > 180) { rightLowerLeg.rotate(5, 30); }
        
        let lArmBendAngle = Math.round( (((leftLowerArm.rotation - leftUpperArm.rotation) % 360) + 360) % 360 );
        if (lArmBendAngle > 180) { leftLowerArm.rotate(5, 30); }
        
        let rArmBendAngle = Math.round( (((rightUpperArm.rotation - rightLowerArm.rotation) % 360) + 360) % 360 );
        if (rArmBendAngle > 180) { rightLowerArm.rotate(-5, 30); }
      }

      function makeCapsuleBoundary() {
        if (boundary) {
            boundary.remove();
        }

        const cx = xMax / 2;
        const cy = yMax / 2;
        const w = currentCapW;
        const h = currentCapH;
        // Radius is constrained to keep it a capsule (cannot exceed half the side)
        const r = Math.min(h / 2, w / 2);
        const straightLen = Math.max(0, w - 2 * r);
        
        const points = [];
        const segments = 20;

        const startX = cx + straightLen / 2;
        const startY = cy - r;

        // Right semi-circle
        for (let i = 0; i <= segments; i++) {
            const theta = -Math.PI / 2 + (Math.PI * i) / segments;
            const px = (cx + straightLen / 2) + r * Math.cos(theta);
            const py = cy + r * Math.sin(theta);
            points.push([px, py]);
        }

        // Left semi-circle
        for (let i = 0; i <= segments; i++) {
            const theta = Math.PI / 2 + (Math.PI * i) / segments;
            const px = (cx - straightLen / 2) + r * Math.cos(theta);
            const py = cy + r * Math.sin(theta);
            points.push([px, py]);
        }

        points.push([startX, startY]);

        boundary = new p.Sprite(points);
        boundary.collider = 'static';
        boundary.shape = 'chain';
        boundary.visible = false; 
      }

      function makePuppet() {
        // Shoulders
        shoulders = new pieces.Sprite();
        shoulders.width = pScale*100;
        shoulders.height = pScale*30;
        shoulders.x = xMax/2;
        shoulders.y = yMax/2;
        
        neck = new pieces.Sprite();
        neck.width = pScale*20;
        neck.height = pScale*50;
        neck.x = xMax/2;
        neck.y = yMax/2 - pScale*30;
        new p.GlueJoint(neck, shoulders);
        
        head = new pieces.Sprite();
        head.diameter = pScale*80;
        head.x = xMax/2;
        head.y = yMax/2 - pScale*70;
        head.img = '😀'; 
        head.textSize = pScale*40;
        new p.GlueJoint(neck, head);
        
        // Left arm
        leftUpperArm = new pieces.Sprite();
        leftUpperArm.width = pScale*20;
        leftUpperArm.height = pScale*60;
        leftUpperArm.x = xMax/2 - pScale*40;
        leftUpperArm.y = yMax/2 + pScale*40;
        leftUpperArm.color = 'cyan';
        
        shoulderHingeA = new pieces.Sprite();
        shoulderHingeA.diameter = pScale*20;
        shoulderHingeA.x = xMax/2 - pScale*40;
        shoulderHingeA.y = yMax/2;
        new p.GlueJoint(shoulderHingeA, leftUpperArm);
        
        shoulderHingeB = new pieces.Sprite();
        shoulderHingeB.diameter = pScale*20;
        shoulderHingeB.x = xMax/2 - pScale*40;
        shoulderHingeB.y = yMax/2;
        new p.GlueJoint(shoulderHingeB, shoulders);
        new p.HingeJoint(shoulderHingeA, shoulderHingeB);
        
        leftLowerArm = new pieces.Sprite();
        leftLowerArm.width = pScale*20;
        leftLowerArm.height = pScale*60;
        leftLowerArm.x = xMax/2 - pScale*40;
        leftLowerArm.y = yMax/2 + pScale*90;
        leftLowerArm.color = 'cyan';
        
        leftElbowHingeA = new pieces.Sprite();
        leftElbowHingeA.diameter = pScale*20;
        leftElbowHingeA.x = xMax/2 - pScale*40;
        leftElbowHingeA.y = yMax/2 + pScale*60;
        new p.GlueJoint(leftElbowHingeA, leftUpperArm);
        
        leftElbowHingeB = new pieces.Sprite();
        leftElbowHingeB.diameter = pScale*20;
        leftElbowHingeB.x = xMax/2 - pScale*40;
        leftElbowHingeB.y = yMax/2 + pScale*60;
        new p.GlueJoint(leftElbowHingeB, leftLowerArm);
        new p.HingeJoint(leftElbowHingeA, leftElbowHingeB);
        
        // Right arm
        rightUpperArm = new pieces.Sprite();
        rightUpperArm.width = pScale*20;
        rightUpperArm.height = pScale*60;
        rightUpperArm.x = xMax/2 + pScale*40;
        rightUpperArm.y = yMax/2 + pScale*30;
        rightUpperArm.color = 'cyan';
        
        shoulderHingeC = new pieces.Sprite();
        shoulderHingeC.diameter = pScale*20;
        shoulderHingeC.x = xMax/2 + pScale*40;
        shoulderHingeC.y = yMax/2;
        new p.GlueJoint(shoulderHingeC, rightUpperArm);
        
        shoulderHingeD = new pieces.Sprite();
        shoulderHingeD.diameter = pScale*20;
        shoulderHingeD.x = xMax/2 + pScale*40;
        shoulderHingeD.y = yMax/2;
        new p.GlueJoint(shoulderHingeD, shoulders);
        new p.HingeJoint(shoulderHingeC, shoulderHingeD);
        
        rightLowerArm = new pieces.Sprite();
        rightLowerArm.width = pScale*20;
        rightLowerArm.height = pScale*60;
        rightLowerArm.x = xMax/2 + pScale*40;
        rightLowerArm.y = yMax/2 + pScale*90;
        rightLowerArm.color = 'cyan';
        
        rightElbowHingeA = new pieces.Sprite();
        rightElbowHingeA.diameter = pScale*20;
        rightElbowHingeA.x = xMax/2 + pScale*40;
        rightElbowHingeA.y = yMax/2 + pScale*60;
        new p.GlueJoint(rightElbowHingeA, rightUpperArm);
        
        rightElbowHingeB = new pieces.Sprite();
        rightElbowHingeB.diameter = pScale*20;
        rightElbowHingeB.x = xMax/2 + pScale*40;
        rightElbowHingeB.y = yMax/2 + pScale*60;
        new p.GlueJoint(rightElbowHingeB, rightLowerArm);
        new p.HingeJoint(rightElbowHingeA, rightElbowHingeB);
        
        torso = new pieces.Sprite();
        torso.width = pScale*50;
        torso.height = pScale*90;
        torso.x = xMax/2;
        torso.y = yMax/2 + pScale*50;
        new p.GlueJoint(torso, shoulders);
        
        hips = new pieces.Sprite();
        hips.width = pScale*100;
        hips.height = pScale*30;
        hips.x = xMax/2;
        hips.y = yMax/2 + pScale*90;
        new p.GlueJoint(torso, hips);
        
        // Left thigh
        leftThigh = new pieces.Sprite();
        leftThigh.width = pScale*30;
        leftThigh.height = pScale*90;
        leftThigh.x = xMax/2 - pScale*40;
        leftThigh.y = yMax/2 + pScale*130;
        leftThigh.color = 'blue';
        
        leftHipHingeA = new pieces.Sprite();
        leftHipHingeA.diameter = pScale*20;
        leftHipHingeA.x = xMax/2 - pScale*40;
        leftHipHingeA.y = yMax/2 + pScale*90;
        new p.GlueJoint(leftHipHingeA, hips);
        
        leftHipHingeB = new pieces.Sprite();
        leftHipHingeB.diameter = pScale*20;
        leftHipHingeB.x = xMax/2 - pScale*40;
        leftHipHingeB.y = yMax/2 + pScale*90;
        new p.GlueJoint(leftHipHingeB, leftThigh);
        new p.HingeJoint(leftHipHingeA, leftHipHingeB);
        
        // Left lower leg
        leftLowerLeg = new pieces.Sprite();
        leftLowerLeg.width = pScale*30;
        leftLowerLeg.height = pScale*90;
        leftLowerLeg.x = xMax/2 - pScale*40;
        leftLowerLeg.y = yMax/2 + pScale*200;
        leftLowerLeg.color = 'blue';
        
        // Left knee
        leftKneeHingeA = new pieces.Sprite();
        leftKneeHingeA.diameter = pScale*20;
        leftKneeHingeA.x = xMax/2 - pScale*40;
        leftKneeHingeA.y = yMax/2 + pScale*170;
        new p.GlueJoint(leftKneeHingeA, leftThigh);
        leftKneeHingeB = new pieces.Sprite();
        leftKneeHingeB.diameter = pScale*20;
        leftKneeHingeB.x = xMax/2 - pScale*40;
        leftKneeHingeB.y = yMax/2 + pScale*170;	
        new p.HingeJoint(leftKneeHingeA, leftKneeHingeB);
        new p.GlueJoint(leftKneeHingeB, leftLowerLeg);
        
        // Left foot
        leftFoot = new pieces.Sprite();
        leftFoot.width = pScale*60;
        leftFoot.height = pScale*30;
        leftFoot.x = xMax/2 - pScale*55;
        leftFoot.y = yMax/2 + pScale*240;
        new p.GlueJoint(leftFoot, leftLowerLeg);
        leftFoot.color = 'blue';
        leftFoot.collides(leftThigh);
        
        // Right thigh
        rightThigh = new pieces.Sprite();
        rightThigh.width = pScale*30;
        rightThigh.height = pScale*90;
        rightThigh.x = xMax/2 + pScale*40;
        rightThigh.y = yMax/2 + pScale*130;
        rightThigh.color = 'blue';
        
        rightHipHingeA = new pieces.Sprite();
        rightHipHingeA.diameter = pScale*20;
        rightHipHingeA.x = xMax/2 + pScale*40;
        rightHipHingeA.y = yMax/2 + pScale*90;
        new p.GlueJoint(rightHipHingeA, hips);
        
        rightHipHingeB = new pieces.Sprite();
        rightHipHingeB.diameter = pScale*20;
        rightHipHingeB.x = xMax/2 + pScale*40;
        rightHipHingeB.y = yMax/2 + pScale*90;
        new p.GlueJoint(rightHipHingeB, rightThigh);
        new p.HingeJoint(rightHipHingeA, rightHipHingeB);
        
        // Right lower leg
        rightLowerLeg = new pieces.Sprite();
        rightLowerLeg.width = pScale*30;
        rightLowerLeg.height = pScale*90;
        rightLowerLeg.x = xMax/2 + pScale*40;
        rightLowerLeg.y = yMax/2 + pScale*200;
        rightLowerLeg.color = 'blue';
        
        // Right knee
        rightKneeHingeA = new pieces.Sprite();
        rightKneeHingeA.diameter = pScale*20;
        rightKneeHingeA.x = xMax/2 + pScale*40;
        rightKneeHingeA.y = yMax/2 + pScale*170;
        new p.GlueJoint(rightKneeHingeA, rightThigh);
        rightKneeHingeB = new pieces.Sprite();
        rightKneeHingeB.diameter = pScale*20;
        rightKneeHingeB.x = xMax/2 + pScale*40;
        rightKneeHingeB.y = yMax/2 + pScale*170;	
        new p.HingeJoint(rightKneeHingeA, rightKneeHingeB);
        new p.GlueJoint(rightKneeHingeB, rightLowerLeg);
        
        // Right foot
        rightFoot = new pieces.Sprite();
        rightFoot.width = pScale*60;
        rightFoot.height = pScale*30;
        rightFoot.x = xMax/2 + pScale*55;
        rightFoot.y = yMax/2 + pScale*240;
        new p.GlueJoint(rightFoot, rightLowerLeg);
        rightFoot.color = 'blue';
        rightFoot.collides(rightThigh);
      }
    };

    // Initialize p5 with the sketch attached to the ref
    // We must use 'window.p5' because we loaded it via CDN
    if (window.p5) {
      p5InstanceRef.current = new window.p5(sketch, containerRef.current);
    }

    return () => {
      stopMovementSound();
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, []);

  return (
    <div className="flex w-full h-full relative overflow-hidden" onClick={resumeAudio}>
        {/* Main Canvas Area */}
        <div 
          className="flex-1 flex flex-col items-center justify-center relative bg-gray-900"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
            {/* Added transform scale and translation to move up and enlarge */}
            <div 
                ref={containerRef} 
                className="rounded-lg overflow-hidden shadow-2xl border border-gray-700 transform scale-[1.35] -translate-y-24" 
            />
            <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded text-xs pointer-events-none">
                {status}
            </div>
            
            {/* Toggle Button for Panel */}
            <button 
              onClick={(e) => {
                  e.stopPropagation();
                  setIsPanelOpen(!isPanelOpen);
                  resumeAudio();
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-l-lg shadow-lg z-20 border-l border-y border-gray-600 transition-transform"
              style={{ transform: isPanelOpen ? 'translateX(0)' : 'translateX(0)' }}
            >
              {isPanelOpen ? '→' : '←'}
            </button>
        </div>

        {/* Right Collapsible Panel */}
        <div 
          className={`bg-gray-800 border-l border-gray-700 shadow-xl z-10 transition-all duration-300 ease-in-out flex flex-col h-full ${isPanelOpen ? 'w-80' : 'w-0'}`}
        >
          <div className="p-4 border-b border-gray-700 overflow-hidden min-w-[320px]">
            <h2 className="text-white font-bold text-lg">Expressions</h2>
            <p className="text-xs text-gray-400">Scroll down to see more faces.</p>
          </div>
          
          {/* Scrollable container for emojis */}
          <div className="flex-1 overflow-y-auto p-4 min-w-[320px] scrollbar-thin scrollbar-thumb-gray-600 max-h-full">
             
             {/* SETTINGS SECTION (Size Controls) */}
             <div className="mb-6 bg-gray-700/30 p-3 rounded-lg border border-gray-700">
                <h3 className="text-sky-400 text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
                   ⚙️ Capsule Size
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-1">
                      <span>Width</span>
                      <span>{capsuleWidth}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="300" 
                      max="620" 
                      value={capsuleWidth} 
                      onChange={(e) => handleResize('w', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-1">
                      <span>Height</span>
                      <span>{capsuleHeight}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="300" 
                      max="460" 
                      value={capsuleHeight} 
                      onChange={(e) => handleResize('h', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                  </div>
                </div>
             </div>

             {/* Special Items Section */}
             <div className="mb-4">
                <h3 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Specials</h3>
                <div className="grid grid-cols-5 gap-2">
                  {SPECIAL_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      draggable
                      onDragStart={(e) => {
                          handleDragStart(e, emoji);
                      }}
                      onClick={() => handleFaceChange(emoji)}
                      className={`w-10 h-10 flex items-center justify-center text-2xl bg-gray-700 hover:bg-gray-600 rounded cursor-grab active:cursor-grabbing hover:scale-110 transition-transform select-none ${emoji === '🫧' ? 'ring-2 ring-sky-400' : ''}`}
                      title={emoji === '🫧' ? "Bubble Capsule: Traps up to 4 items!" : ""}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

            <div className="border-t border-gray-700 my-4"></div>

            <h3 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Faces</h3>
            <div className="grid grid-cols-5 gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  draggable
                  onDragStart={(e) => {
                      handleDragStart(e, emoji);
                  }}
                  onClick={() => handleFaceChange(emoji)}
                  className="w-10 h-10 flex items-center justify-center text-2xl bg-gray-700 hover:bg-gray-600 rounded cursor-grab active:cursor-grabbing hover:scale-110 transition-transform select-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
    </div>
  );
};

export default HandPuppet;