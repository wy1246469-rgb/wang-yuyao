import React, { useEffect, useRef, useState } from 'react';
import { CustomWindow, Hand, Keypoint } from '../types';
import { playFaceChangeSound, playDropSound, updateMovementSound, stopMovementSound, resumeAudio, playFartSound } from '../utils/sound';

declare const window: CustomWindow;

// Special items requested by user
const SPECIAL_EMOJIS = [
  "🐶", "🐱", "🐭", "🐹", "🐰", // 5 Animals
  "💩", "🚽", "🖕", "🫧" // Poop, Toilet, Middle Finger, Bubble
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

// Shapes available (Only Capsule requested now)
const SHAPES = [
  { id: 'capsule', icon: '💊', label: 'Capsule' },
];

// Text Block presets
const TEXT_BLOCKS = [
  { text: "呼吸是底色", label: "Breath", type: "breath" },
  { text: "情绪是纹理", label: "Texture", type: "emotion" },
  { text: "Emotion", label: "Emotion", type: "simple" },
  { text: "Yourself", label: "Yourself", type: "simple" }
];

const HandPuppet: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);
  
  const [status, setStatus] = useState<string>('Initializing...');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true); // Open by default for new UI
  
  // Capsule Size State
  const [capsuleWidth, setCapsuleWidth] = useState(580);
  const [capsuleHeight, setCapsuleHeight] = useState(420);
  
  // Shape State
  const [currentShape, setCurrentShape] = useState<string>('capsule');

  // Text Block Config - Default smaller size
  const [textSizeVal, setTextSizeVal] = useState(18);
  
  // Fisheye Intensity State
  const [fisheyeStrength, setFisheyeStrength] = useState(0);
  const [displacementMapUrl, setDisplacementMapUrl] = useState<string>(''); 
  
  // Video Brightness State (Default lowered to 100 for "deepened" look)
  const [videoBrightness, setVideoBrightness] = useState(100);

  // Rotation State
  const [rotationSpeed, setRotationSpeed] = useState(0.5); 

  // Function to change the face (called from React UI)
  const handleFaceChange = (emoji: string) => {
    resumeAudio();
    playFaceChangeSound();
    if (p5InstanceRef.current && p5InstanceRef.current.setPuppetFace) {
      p5InstanceRef.current.setPuppetFace(emoji);
    }
  };

  const handleShapeChange = (shapeId: string) => {
    setCurrentShape(shapeId);
    if (p5InstanceRef.current && p5InstanceRef.current.changeBoundaryShape) {
      p5InstanceRef.current.changeBoundaryShape(shapeId);
    }
  };

  const handleSpawnText = (text: string, type: string) => {
    resumeAudio();
    if (p5InstanceRef.current && p5InstanceRef.current.spawnTextBlock) {
      p5InstanceRef.current.spawnTextBlock(text, type, textSizeVal);
    }
  };

  // Handle resizing the capsule
  const handleResize = (dim: 'w' | 'h', val: number) => {
    if (dim === 'w') setCapsuleWidth(val);
    if (dim === 'h') setCapsuleHeight(val);
    
    if (p5InstanceRef.current && p5InstanceRef.current.updateCapsuleSize) {
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
    e.preventDefault(); 
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    resumeAudio();
    const emoji = e.dataTransfer.getData("text/plain");
    
    if (p5InstanceRef.current && p5InstanceRef.current.spawnEmoji && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasWidth = 640; 
      const canvasHeight = 480;
      
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      p5InstanceRef.current.spawnEmoji(x, y, emoji);
      playDropSound();
    }
  };

  useEffect(() => {
    if (p5InstanceRef.current && p5InstanceRef.current.updateRotationSpeed) {
       p5InstanceRef.current.updateRotationSpeed(rotationSpeed);
    }
  }, [rotationSpeed]);
  
  useEffect(() => {
    if (p5InstanceRef.current && p5InstanceRef.current.updateVideoBrightness) {
       p5InstanceRef.current.updateVideoBrightness(videoBrightness);
    }
  }, [videoBrightness]);

  useEffect(() => {
    if (containerRef.current) {
        const scale = 1.35 + (fisheyeStrength * 0.2);
        const translateY = -6; 
        containerRef.current.style.transform = 
            `scale(${scale}) translateY(${translateY}rem)`;
    }
  }, [fisheyeStrength]);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: any) => {
      let handpose: any;
      let video: any;
      let hands: Hand[] = [];
      let prevHandX = 0;
      let prevHandY = 0;
      
      let pieces: any;
      let emojisGroup: any;
      let bubblesGroup: any; 
      let particlesGroup: any; 
      let lightBurstGroup: any;
      let textBlocksGroup: any;

      let head: any, shoulders: any, neck: any;
      let leftUpperArm: any, leftLowerArm: any, rightUpperArm: any, rightLowerArm: any;
      let torso: any, hips: any;
      let leftThigh: any, leftLowerLeg: any, leftFoot: any;
      let rightThigh: any, rightLowerLeg: any, rightFoot: any;
      
      let boundary: any;
      let currentShapeType = 'capsule';
      
      let currentCapW = 580;
      let currentCapH = 420;
      
      let capsuleRotationAngle = 0;
      let capsuleRotationSpeed = 0.5;
      let currentBreathScale = 1;
      
      let currentVideoBrightness = 100;

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

      // Helper for boundary checks
      const getCapsuleParams = () => {
        const cx = xMax / 2;
        const cy = yMax / 2;
        const w = currentCapW; 
        const h = currentCapH;
        const r = Math.min(h / 2, w / 2);
        const isHorizontal = w >= h;
        const straightLen = isHorizontal ? w - 2 * r : h - 2 * r;
        return { cx, cy, r, straightLen, isHorizontal };
      };

      const constrainPoint = (x: number, y: number, padding = 30) => {
        const { cx, cy, r, straightLen, isHorizontal } = getCapsuleParams();
        const halfLen = straightLen / 2;
        
        // Use a slightly smaller radius to ensure the center of the item is well inside
        const safeR = r * 0.95 - padding; 
        const maxDist = Math.max(10, safeR);

        let closestX = x;
        let closestY = y;

        if (isHorizontal) {
            // Horizontal spine at y=cy, x from cx-half to cx+half
            if (closestX < cx - halfLen) closestX = cx - halfLen;
            if (closestX > cx + halfLen) closestX = cx + halfLen;
            closestY = cy;
        } else {
            // Vertical spine at x=cx, y from cy-half to cy+half
            closestX = cx;
            if (closestY < cy - halfLen) closestY = cy - halfLen;
            if (closestY > cy + halfLen) closestY = cy + halfLen;
        }
        
        const dx = x - closestX;
        const dy = y - closestY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            return {
                x: closestX + Math.cos(angle) * maxDist,
                y: closestY + Math.sin(angle) * maxDist
            };
        }
        return { x, y };
      };

      const enforceBounds = () => {
         // Check puppet pieces
         if (pieces) {
             for (let part of pieces) {
                 if (part.removed) continue;
                 const constrained = constrainPoint(part.x, part.y, part.width ? part.width/2 : 20);
                 if (Math.abs(part.x - constrained.x) > 1 || Math.abs(part.y - constrained.y) > 1) {
                     // Gently pull back
                     part.x = p.lerp(part.x, constrained.x, 0.1);
                     part.y = p.lerp(part.y, constrained.y, 0.1);
                     part.vel.x *= 0.5;
                     part.vel.y *= 0.5;
                 }
             }
         }
         
         // Also check emojis/text blocks if they get squeezed out
         const groupsToCheck = [emojisGroup, textBlocksGroup, bubblesGroup];
         groupsToCheck.forEach(g => {
             if (!g) return;
             for(let sprite of g) {
                 if(sprite.removed) continue;
                 const padding = (sprite.width || sprite.diameter || 30) / 2;
                 const constrained = constrainPoint(sprite.x, sprite.y, padding);
                 if (Math.abs(sprite.x - constrained.x) > 1 || Math.abs(sprite.y - constrained.y) > 1) {
                     sprite.x = p.lerp(sprite.x, constrained.x, 0.2);
                     sprite.y = p.lerp(sprite.y, constrained.y, 0.2);
                     sprite.vel.x *= 0.1;
                     sprite.vel.y *= 0.1;
                 }
             }
         });
      };

      p.setPuppetFace = (emoji: string) => {
        if (head) head.img = emoji; 
      };

      p.updateCapsuleSize = (w: number, h: number) => {
         currentCapW = w;
         currentCapH = h;
         makeBoundary(currentShapeType);
      };

      p.changeBoundaryShape = (shape: string) => {
         currentShapeType = shape;
         makeBoundary(shape);
      }
      
      p.updateRotationSpeed = (s: number) => {
         capsuleRotationSpeed = s;
      };
      
      p.updateVideoBrightness = (v: number) => {
         currentVideoBrightness = v;
      };

      p.spawnTextBlock = (text: string, type: string, size: number) => {
         if (!textBlocksGroup) return;
         // Spawn in random pos near center top
         const x = xMax/2 + p.random(-50, 50);
         const y = yMax/2 - 100;
         
         const block = new textBlocksGroup.Sprite(x, y);
         block.text = text;
         block.textSize = size;
         block.textColor = 'white';
         
         // Reduce size padding for smaller look
         const charFactor = text.length > 2 ? 0.8 : 1.1;
         block.w = text.length * size * charFactor + 20; 
         block.h = size * 1.8;
         block.blockType = type; // 'breath', 'emotion', 'simple'
         
         block.bounciness = 0.6;
         block.friction = 0.2;
         block.rotationDrag = 0.05;

         // Custom aesthetics rendering
         block.draw = () => {
            p.push();
            p.rectMode(p.CENTER);
            p.noStroke();
            
            // "Breath" logic - pulsing background color
            if (block.blockType === 'breath' || block.text.includes("呼吸")) {
               const breath = (Math.sin(p.frameCount * 0.05) + 1) / 2; // 0 to 1
               // Interpolate between two pastel colors
               const r = p.map(breath, 0, 1, 255, 173);
               const g = p.map(breath, 0, 1, 182, 216);
               const b = p.map(breath, 0, 1, 193, 230);
               p.fill(r, g, b, 200);
               p.rect(0, 0, block.w, block.h, 12);
            } 
            // "Emotion" logic - textured look
            else if (block.blockType === 'emotion' || block.text.includes("情绪")) {
                p.fill(60, 60, 70, 240); // Darker base
                p.rect(0, 0, block.w, block.h, 12);

                // Texture Overlay
                p.fill(255, 40);
                for(let i=0; i<15; i++) {
                   const nx = (p.noise(p.frameCount * 0.01 + i * 10) - 0.5) * block.w;
                   const ny = (p.noise(p.frameCount * 0.01 + i * 20) - 0.5) * block.h;
                   p.circle(nx, ny, p.random(1, 3));
                }
                
                // Gradient-ish stroke
                p.strokeWeight(2);
                p.stroke(255, 100, 100, 100);
                p.noFill(); 
                p.rect(0, 0, block.w, block.h, 10);
            }
            else {
                // Default aesthetic
                p.fill(100, 100, 120, 200);
                p.stroke(255, 50);
                p.strokeWeight(1);
                p.rect(0, 0, block.w, block.h, 12);
            }
            
            // Draw Text
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(block.textSize);
            p.fill(255);
            p.noStroke();
            p.text(block.text, 0, 0);
            
            p.pop();
         };
      };

      const spawnParticles = (x: number, y: number, colorVal: any) => {
         if (!particlesGroup) return;
         const count = 12; 
         for(let i=0; i<count; i++) {
             const part = new particlesGroup.Sprite(x, y, 5);
             part.color = colorVal || p.color(255, 255, 0);
             const angle = p.random(0, 360);
             const speed = p.random(2, 8);
             part.vel.x = Math.cos(angle * Math.PI / 180) * speed;
             part.vel.y = Math.sin(angle * Math.PI / 180) * speed;
             part.life = 40; 
             part.stroke = 'none';
             part.update = () => {
                 if (part.life < 10) {
                     part.scale = p.map(part.life, 0, 10, 0, 0.5);
                 }
             }
         }
      };
      
      const spawnLightBurst = (x: number, y: number) => {
         if (!lightBurstGroup) return;
         const burst = new lightBurstGroup.Sprite(x, y, 10);
         burst.collider = 'none';
         burst.life = 30; 
         burst.stroke = 'none';
         burst.color = p.color(255, 255, 255, 0);
         
         burst.draw = () => {
            const radius = p.map(30 - burst.life, 0, 30, 20, 150);
            const alpha = p.map(burst.life, 0, 30, 0, 200);
            p.noStroke();
            for(let r = 0; r < 5; r++) {
               p.fill(255, 255, 255, alpha / (r + 1));
               p.circle(0, 0, radius * (1 - r*0.15));
            }
         };
      };

      p.spawnEmoji = (x: number, y: number, emoji: string) => {
        if (!emojisGroup) return;

        if (emoji === "🫧") {
           const size = 60; // Reduced from 80
           const bubble = new bubblesGroup.Sprite(x, y, size);
           bubble.capturedItems = []; 
           
           bubble.bounciness = 0.95; 
           bubble.friction = 0.02;   
           bubble.frictionAir = 0.03; 
           bubble.mass = 0.8;        
           
           bubble.draw = () => {
              const wobble = Math.sin(p.frameCount * 0.1 + bubble.id) * 2;
              const d = bubble.diameter + wobble;

              p.fill(173, 216, 230, 60); 
              p.strokeWeight(4);
              p.stroke(0, 255, 255, 200); 
              p.circle(0, 0, d);
              p.noFill();
              p.strokeWeight(2);
              p.stroke(255, 255, 255, 150);
              p.circle(0, 0, d - 4);
              p.noStroke();
              p.fill(255, 255, 255, 230);
              p.circle(d * 0.25, -d * 0.25, d * 0.2);

              if (bubble.capturedItems && bubble.capturedItems.length > 0) {
                 const len = bubble.capturedItems.length;
                 for(let i=0; i<len; i++) {
                    p.push();
                    const angle = (i * (360 / len)) * (Math.PI / 180);
                    const jitterX = Math.cos(angle) * 10;
                    const jitterY = Math.sin(angle) * 10;
                    p.translate(jitterX, jitterY);
                    p.rotate(i * 15 + p.frameCount); 
                    p.imageMode(p.CENTER);
                    p.scale(1.0); 
                    if (bubble.capturedItems[i]) {
                       p.image(bubble.capturedItems[i], 0, 0);
                    }
                    p.pop();
                 }
              }
           };
           return;
        }

        // Reduced random size
        const size = (Math.random() * 15 + 25); // Was 30+30
        const emojiSprite = new emojisGroup.Sprite(x, y, size);
        emojiSprite.img = emoji; 
        emojiSprite.shape = 'circle';
        emojiSprite.fartCount = 0;
        emojiSprite.isEmoji = true; 
        emojiSprite.processedOutcome = false; 
        
        emojiSprite.bounciness = 0.8;
        emojiSprite.friction = 0.1;
        emojiSprite.rotationDrag = 0.01;
        
        emojiSprite.draw = () => {
            p.push();
            const alpha = 200 + 55 * Math.sin(p.frameCount * 0.1);
            p.tint(255, alpha);
            if (emojiSprite.image) {
                p.imageMode(p.CENTER);
                p.image(emojiSprite.image, 0, 0, emojiSprite.w, emojiSprite.h);
            }
            p.pop();
        };
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
        p.angleMode(p.DEGREES);

        const pg = p.createGraphics(256, 256);
        pg.background(128); 
        pg.noStroke();
        for(let r = 256; r > 0; r-=3) {
            const val = p.map(r, 0, 256, 255, 128); 
            pg.fill(val);
            pg.ellipse(128, 128, r, r);
        }
        setDisplacementMapUrl(pg.canvas.toDataURL());
        pg.remove(); 

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

        if (p.Group) {
            pieces = new p.Group();
            pieces.color = 'white';
            pieces.overlaps(pieces); 
            pieces.stroke = 'white';
            pieces.drag = 1;
            
            emojisGroup = new p.Group();
            emojisGroup.bounciness = 0.7;
            emojisGroup.friction = 0.2;
            emojisGroup.rotationLock = false; 

            bubblesGroup = new p.Group();
            bubblesGroup.bounciness = 0.95; 
            
            particlesGroup = new p.Group();
            particlesGroup.collider = 'none'; 
            particlesGroup.frictionAir = 0.1;
            particlesGroup.life = 30; 
            particlesGroup.scale = 0.5;

            lightBurstGroup = new p.Group();
            lightBurstGroup.collider = 'none';
            
            textBlocksGroup = new p.Group();
            textBlocksGroup.layer = 2; // On top

            makePuppet();
            makeBoundary('capsule');
            
            const tryPlayFart = (sprite: any) => {
                if (sprite.fartCount === undefined) sprite.fartCount = 0;
                if (sprite.fartCount < 1) {
                    playFartSound();
                    sprite.fartCount++;
                }
            };

            const handleCollision = (a: any, b: any) => {
               if (a.removed || b.removed || a.markedForRemoval || b.markedForRemoval) return true;

               const processSprite = (sprite: any) => {
                   if (sprite.isEmoji && !sprite.removed && !sprite.markedForRemoval && !sprite.processedOutcome) {
                       sprite.processedOutcome = true; 
                       if (Math.random() < 0.2) {
                           spawnParticles(sprite.x, sprite.y, p.color(255, 200, 100));
                           playDropSound(); 
                           sprite.markedForRemoval = true; 
                           sprite.remove(); 
                       } else {
                           tryPlayFart(sprite); 
                       }
                   }
               };

               processSprite(a);
               if (!a.markedForRemoval && !a.removed) processSprite(b);
               return true;
            };

            if (boundary) {
               emojisGroup.collides(boundary, handleCollision);
               bubblesGroup.collides(boundary);
               textBlocksGroup.collides(boundary);
            }
            if (pieces) {
               emojisGroup.collides(pieces, handleCollision);
               bubblesGroup.collides(pieces); 
               textBlocksGroup.collides(pieces);
            }
            
            emojisGroup.collides(emojisGroup, handleCollision);
            textBlocksGroup.collides(emojisGroup);
            textBlocksGroup.collides(textBlocksGroup);

            bubblesGroup.collides(emojisGroup, (bubble: any, emoji: any) => {
                if (bubble.removed || emoji.removed || bubble.markedForRemoval || emoji.markedForRemoval) return true;
                if (!bubble.capturedItems) bubble.capturedItems = [];
                if (bubble.capturedItems.length < 4) {
                   if (emoji.image) bubble.capturedItems.push(emoji.image);
                   spawnParticles(emoji.x, emoji.y, p.color(100, 200, 255)); 
                   emoji.markedForRemoval = true;
                   emoji.remove();
                   bubble.diameter += 5;
                   playDropSound();
                } else {
                   return true;
                }
            });
            
            bubblesGroup.collides(bubblesGroup, (b1: any, b2: any) => {
                if (b1.removed || b2.removed || b1.markedForRemoval || b2.markedForRemoval) return true;
                const midX = (b1.x + b2.x) / 2;
                const midY = (b1.y + b2.y) / 2;
                spawnLightBurst(midX, midY);
                playDropSound(); 
                b1.markedForRemoval = true;
                b2.markedForRemoval = true;
                b1.remove();
                b2.remove();
            });

        } else {
            console.error("p5play Group not found on p5 instance.");
            setStatus("Error: p5play not loaded properly");
        }
      };

      p.draw = () => {
        // Breathing Background Color
        const breath = Math.sin(p.frameCount * 0.03); 
        // Modulate gray-800 values (rgb(31, 41, 55)) slightly
        const bgR = 31 + breath * 2;
        const bgG = 41 + breath * 3;
        const bgB = 55 + breath * 5;
        p.background(bgR, bgG, bgB);

        showVideo(); 
        
        capsuleRotationAngle += capsuleRotationSpeed;
        capsuleRotationAngle %= 360; 
        
        // Breathing Scale for Capsule
        currentBreathScale = 1 + 0.015 * Math.sin(p.frameCount * 0.04);
        
        if (boundary) {
            boundary.rotation = capsuleRotationAngle;
            // Scale physics body slightly (p5play v3 supports this)
            boundary.scale = currentBreathScale;
        }

        // Draw visuals for the current shape with scale
        drawBoundaryVisuals(currentShapeType, capsuleRotationAngle, currentBreathScale);
        
        getHandedness();
        movePuppet();
        correctJointAngles();
        enforceBounds(); // Keep things inside
      };

      function drawBoundaryVisuals(type: string, angle: number, scaleFactor: number) {
         p.push();
         p.translate(xMax/2, yMax/2);
         p.rotate(angle);
         p.scale(scaleFactor); // Apply breathing scale to visual drawing
         p.noFill();
         p.strokeWeight(1.5);
         
         if (type === 'capsule') {
             drawGradientCapsule();
             drawGlassReflectionCapsule();
         } else {
             // Fallback/Generic drawing just in case
             const vertices = getShapeVertices(type);
             for(let i=0; i<10; i++) {
                 p.stroke(56, 189, 248, 200 - i * 20);
                 p.strokeWeight(2 + i);
                 p.beginShape();
                 for(let v of vertices) {
                     p.vertex(v[0] - xMax/2, v[1] - yMax/2); 
                 }
                 p.endShape(p.CLOSE);
             }
         }
         p.pop();
      }

      function getShapeVertices(type: string) {
        const cx = xMax / 2;
        const cy = yMax / 2;
        const w = currentCapW;
        const h = currentCapH;
        let points = [];
        const scale = w / 600; 

        // Capsule Default
        const r = Math.min(w / 2, h / 2);
        
        if (w >= h) {
            // Horizontal Stadium
            const straightLen = w - 2 * r;
            // Right semi-circle
            for (let i = 0; i <= 20; i++) {
                const theta = -Math.PI / 2 + (Math.PI * i) / 20;
                points.push([(cx + straightLen / 2) + r * Math.cos(theta), cy + r * Math.sin(theta)]);
            }
            // Left semi-circle
            for (let i = 0; i <= 20; i++) {
                const theta = Math.PI / 2 + (Math.PI * i) / 20;
                points.push([(cx - straightLen / 2) + r * Math.cos(theta), cy + r * Math.sin(theta)]);
            }
            points.push([cx + straightLen / 2, cy - r]); // Close loop
        } else {
            // Vertical Stadium
            const straightLen = h - 2 * r;
            // Bottom semi-circle (0 to PI)
            for (let i = 0; i <= 20; i++) {
                const theta = 0 + (Math.PI * i) / 20;
                points.push([cx + r * Math.cos(theta), (cy + straightLen / 2) + r * Math.sin(theta)]);
            }
            // Top semi-circle (PI to 2PI)
            for (let i = 0; i <= 20; i++) {
                const theta = Math.PI + (Math.PI * i) / 20;
                points.push([cx + r * Math.cos(theta), (cy - straightLen / 2) + r * Math.sin(theta)]);
            }
            points.push([cx + r, cy + straightLen / 2]); // Close loop
        }
        return points;
      }

      function makeBoundary(type: string) {
        if (boundary) {
            boundary.remove();
        }
        const points = getShapeVertices(type);
        boundary = new p.Sprite(points);
        boundary.collider = 'kinematic';
        boundary.shape = 'chain';
        boundary.visible = false; 
        
        // Re-establish collisions since boundary is new
        if (emojisGroup && bubblesGroup && textBlocksGroup) {
             emojisGroup.collides(boundary);
             bubblesGroup.collides(boundary);
             textBlocksGroup.collides(boundary);
        }
      }

      // Re-use existing gradient drawer for capsule
      function drawGradientCapsule() {
        const { cx, cy, r, straightLen, isHorizontal } = getCapsuleParams();
        const halfLen = straightLen / 2;
        const thickness = 60; 
        
        for (let i = 0; i < thickness; i += 1) {
            const t = i / thickness; 
            const alpha = 180 * Math.pow(1 - t, 2); 
            
            if (i < 2) p.stroke(255, 255, 255, 200); 
            else p.stroke(56, 189, 248, alpha); 
            
            p.strokeWeight(1.5); 
            const currentR = r - i;
            if (currentR < 0) break;

            p.beginShape();
            if (isHorizontal) {
                p.vertex(halfLen, -currentR);
                for (let a = -90; a <= 90; a += 10) p.vertex(halfLen + currentR * Math.cos(a*Math.PI/180), currentR * Math.sin(a*Math.PI/180));
                p.vertex(-halfLen, currentR);
                for (let a = 90; a <= 270; a += 10) p.vertex(-halfLen + currentR * Math.cos(a*Math.PI/180), currentR * Math.sin(a*Math.PI/180));
            } else {
                // Vertical drawing logic relative to (0,0) center of sprite
                p.vertex(currentR, halfLen);
                for (let a = 0; a <= 180; a += 10) p.vertex(currentR * Math.cos(a*Math.PI/180), halfLen + currentR * Math.sin(a*Math.PI/180));
                p.vertex(-currentR, -halfLen);
                for (let a = 180; a <= 360; a += 10) p.vertex(currentR * Math.cos(a*Math.PI/180), -halfLen + currentR * Math.sin(a*Math.PI/180));
            }
            p.endShape(p.CLOSE);
        }
      }

      function drawGlassReflectionCapsule() {
          const { cx, cy, r, straightLen, isHorizontal } = getCapsuleParams();
          const halfLen = straightLen / 2;
          const inset = 20; 
          const reflectR = Math.max(10, r - inset);

          p.noFill();
          p.strokeWeight(12);
          p.strokeCap(p.ROUND);
          p.stroke(255, 100);
          p.beginShape();
          
          if (isHorizontal) {
              const startAngle = Math.PI + 0.4;
              const endAngle = Math.PI * 1.5 - 0.2;
              for (let a = startAngle; a <= endAngle; a += 0.1) {
                  const px = (-halfLen) + reflectR * Math.cos(a);
                  const py = reflectR * Math.sin(a);
                  p.vertex(px, py);
              }
          } else {
               // Vertical reflection: top left quadrant
               const startAngle = Math.PI + 0.4;
               const endAngle = Math.PI * 1.5 - 0.2;
               for (let a = startAngle; a <= endAngle; a += 0.1) {
                  const px = reflectR * Math.cos(a);
                  const py = (-halfLen) + reflectR * Math.sin(a);
                  p.vertex(px, py);
              }
          }
          p.endShape();
          
          p.stroke(255, 200);
          p.strokeWeight(6);
          
          let specX, specY;
          if (isHorizontal) {
              specX = (-halfLen) + reflectR * Math.cos(Math.PI + 0.8);
              specY = reflectR * Math.sin(Math.PI + 0.8);
          } else {
              specX = reflectR * Math.cos(Math.PI + 0.8);
              specY = (-halfLen) + reflectR * Math.sin(Math.PI + 0.8);
          }
          p.point(specX, specY);
      }

      function gotHands(results: any) {
        if (results && results.length >= 0) {
            hands = results;
        }
      }

      function showVideo() {
        p.push();
        if (options.flipHorizontal){
            p.translate(p.width, 0); 
            p.scale(-1, 1);
        }
        let transparency = 50; 
        p.tint(currentVideoBrightness, currentVideoBrightness, currentVideoBrightness, transparency); 
        p.image(video, 0, 0, p.width, p.height);
        p.pop();
      }

      function getHandedness() {
        if (!hands || hands.length === 0) return;
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
            if (hands[0].keypoints && hands[0].keypoints.length > 12) {
                jointToTrack = hands[0].keypoints[12];
                
                // CRITICAL FIX: Calculate target FIRST (with offset), then constrain the target.
                const rawHeadX = jointToTrack.x;
                const rawHeadY = jointToTrack.y + yGap;

                const constrained = constrainPoint(rawHeadX, rawHeadY);
                targetX = constrained.x;
                targetY = constrained.y;
                isTracking = true;

                head.moveTowards(targetX, targetY, 0.5);
                p.line(head.x, head.y, jointToTrack.x, jointToTrack.y); // Line connects to actual hand

                if (whichHand === 'Left') { jointToTrack = hands[0].keypoints[16]; } else { jointToTrack = hands[0].keypoints[8]; }
                if (leftLowerArm && jointToTrack) {
                    const rawX = jointToTrack.x;
                    const rawY = jointToTrack.y + yGap;
                    const c = constrainPoint(rawX, rawY);
                    leftLowerArm.moveTowards(c.x, c.y, 0.5);
                    p.line(leftLowerArm.x, leftLowerArm.y, jointToTrack.x, jointToTrack.y);
                }

                if (whichHand === 'Left') { jointToTrack = hands[0].keypoints[8]; } else { jointToTrack = hands[0].keypoints[16]; }
                if (rightLowerArm && jointToTrack) {
                    const rawX = jointToTrack.x;
                    const rawY = jointToTrack.y + yGap;
                    const c = constrainPoint(rawX, rawY);
                    rightLowerArm.moveTowards(c.x, c.y, 0.5);
                    p.line(rightLowerArm.x, rightLowerArm.y, jointToTrack.x, jointToTrack.y);
                }

                if (whichHand === 'Left') { jointToTrack = hands[0].keypoints[20]; } else { jointToTrack = hands[0].keypoints[4]; }
                if (leftKneeHingeB && jointToTrack) {
                    const rawX = jointToTrack.x;
                    const rawY = jointToTrack.y + yGap + 200 * pScale;
                    const c = constrainPoint(rawX, rawY);
                    leftKneeHingeB.moveTowards(c.x, c.y, 1);
                    p.line(leftKneeHingeB.x, leftKneeHingeB.y, jointToTrack.x, jointToTrack.y);
                }

                if (whichHand === 'Right') { jointToTrack = hands[0].keypoints[20]; } else { jointToTrack = hands[0].keypoints[4]; }
                if (rightKneeHingeB && jointToTrack) {
                    const rawX = jointToTrack.x;
                    const rawY = jointToTrack.y + yGap + 200 * pScale;
                    const c = constrainPoint(rawX, rawY);
                    rightKneeHingeB.moveTowards(c.x, c.y, 1);
                    p.line(rightKneeHingeB.x, rightKneeHingeB.y, jointToTrack.x, jointToTrack.y);
                }
            }
        }
        
        if (isTracking) {
          // Track movement speed based on actual hand input to keep sound responsive to user effort
          // even if puppet is stuck against wall.
          const speed = p.dist(targetX, targetY, prevHandX, prevHandY); // Approximate
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
        
        {displacementMapUrl && (
           <svg className="absolute w-0 h-0 pointer-events-none" style={{display: 'block'}}>
             <defs>
               <filter id="fisheye">
                 <feImage href={displacementMapUrl} result="lens" preserveAspectRatio="none" />
                 <feDisplacementMap 
                    in="SourceGraphic" 
                    in2="lens" 
                    scale={fisheyeStrength * 100} 
                    xChannelSelector="R" 
                    yChannelSelector="R" 
                 />
               </filter>
             </defs>
           </svg>
        )}

        {/* LEFT COLLAPSIBLE PANEL */}
        <div 
          className={`bg-gray-800 border-r border-gray-700 shadow-xl z-20 transition-all duration-300 ease-in-out flex flex-col absolute left-0 top-0 h-full ${isLeftPanelOpen ? 'w-64' : 'w-0'}`}
        >
           <div className="flex-1 overflow-y-auto min-w-[256px] p-4 scrollbar-thin scrollbar-thumb-gray-600">
              <h2 className="text-white font-bold text-lg mb-4">Settings</h2>
              
              {/* Shape Selector */}
              <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 mb-4">
                  <h3 className="text-sky-400 text-xs font-bold mb-3 uppercase tracking-wider">
                      🔷 Shapes
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {SHAPES.map(shape => (
                        <button 
                          key={shape.id}
                          onClick={() => handleShapeChange(shape.id)}
                          className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${currentShape === shape.id ? 'bg-sky-500 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
                        >
                            <span className="text-2xl mb-1">{shape.icon}</span>
                            <span className="text-[10px]">{shape.label}</span>
                        </button>
                    ))}
                  </div>
              </div>

              {/* Text Spawner */}
              <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 mb-4">
                  <h3 className="text-sky-400 text-xs font-bold mb-3 uppercase tracking-wider">
                      💬 Add Text
                  </h3>
                  <div className="mb-3">
                     <label className="text-xs text-gray-400 mb-1 block">Text Size: {textSizeVal}px</label>
                     <input 
                       type="range" min="16" max="64" value={textSizeVal}
                       onChange={(e) => setTextSizeVal(parseInt(e.target.value))}
                       className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     {TEXT_BLOCKS.map(block => (
                        <button 
                          key={block.label}
                          onClick={() => handleSpawnText(block.text, block.type)}
                          className="bg-gray-600 hover:bg-gray-500 text-white text-xs py-2 px-1 rounded truncate border border-gray-500"
                          title={block.text}
                        >
                            {block.label}
                        </button>
                     ))}
                  </div>
              </div>

              {/* Camera & Visual Controls */}
              <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 mb-4">
                  <h3 className="text-sky-400 text-xs font-bold mb-3 uppercase tracking-wider">
                      👁️ Visuals
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Camera Brightness</label>
                      <input 
                        type="range" min="0" max="255" 
                        value={videoBrightness} 
                        onChange={(e) => setVideoBrightness(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Fisheye Effect</label>
                      <input 
                        type="range" min="0" max="1" step="0.01"
                        value={fisheyeStrength} 
                        onChange={(e) => setFisheyeStrength(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                      />
                    </div>
                  </div>
              </div>

              <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 mb-4">
                  <h3 className="text-sky-400 text-xs font-bold mb-3 uppercase tracking-wider">
                      🔄 Spin
                  </h3>
                  <div>
                    <input 
                      type="range" min="0" max="5" step="0.1"
                      value={rotationSpeed} 
                      onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                  </div>
              </div>
           </div>
           
           <button 
              onClick={(e) => {
                  e.stopPropagation();
                  setIsLeftPanelOpen(!isLeftPanelOpen);
                  resumeAudio();
              }}
              className="absolute -right-8 top-12 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-r-lg shadow-lg border-r border-y border-gray-600"
            >
              {isLeftPanelOpen ? '←' : '→'}
            </button>
        </div>


        {/* Main Canvas Area */}
        <div 
          className="flex-1 flex flex-col items-center justify-center relative bg-gray-900"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
            <div 
                ref={containerRef} 
                className="rounded-lg overflow-hidden shadow-2xl border border-gray-700 transition-all duration-75" 
                style={{ 
                    filter: fisheyeStrength > 0.05 ? 'url(#fisheye)' : 'none',
                    transform: `scale(${1.35 + (fisheyeStrength * 0.2)}) translateY(-6rem)`
                }}
            />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white p-2 rounded text-xs pointer-events-none">
                {status}
            </div>
            
            <button 
              onClick={(e) => {
                  e.stopPropagation();
                  setIsRightPanelOpen(!isRightPanelOpen);
                  resumeAudio();
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-l-lg shadow-lg z-20 border-l border-y border-gray-600 transition-transform"
              style={{ transform: isRightPanelOpen ? 'translateX(0)' : 'translateX(0)' }}
            >
              {isRightPanelOpen ? '→' : '←'}
            </button>
        </div>

        {/* Right Collapsible Panel */}
        <div 
          className={`bg-gray-800 border-l border-gray-700 shadow-xl z-10 transition-all duration-300 ease-in-out flex flex-col h-full ${isRightPanelOpen ? 'w-80' : 'w-0'}`}
        >
          <div className="p-4 border-b border-gray-700 overflow-hidden min-w-[320px]">
            <h2 className="text-white font-bold text-lg">Expressions</h2>
            <p className="text-xs text-gray-400">Scroll down to see more faces.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 min-w-[320px] scrollbar-thin scrollbar-thumb-gray-600 max-h-full">
             
             <div className="mb-6 bg-gray-700/30 p-3 rounded-lg border border-gray-700">
                <h3 className="text-sky-400 text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
                   ⚙️ Size
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-1">
                      <span>Width</span>
                      <span>{capsuleWidth}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="300" max="620" 
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
                      min="300" max="460" 
                      value={capsuleHeight} 
                      onChange={(e) => handleResize('h', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                  </div>
                </div>
             </div>

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