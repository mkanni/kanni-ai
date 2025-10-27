import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { OpenaiService } from './services/openai.service';
import { SupabaseService } from './services/supabase.service';
import { TelemetryService } from './services/telemetry.service';
import { User } from '@supabase/supabase-js';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  radius: number;
}

@Component({
  selector: 'app-learning',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('networkCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  username: string = '';
  interests: string[] = [];
  generatedTip: string = '';
  isLoading: boolean = false;
  isCohesive: boolean = false;
  selectedInterests: string[] = [];
  currentUser: User | null = null;
  
  typewriterText: string = '';
  currentMessageIndex: number = 0;
  currentCharIndex: number = 0;
  isDeleting: boolean = false;
  typewriterInterval: any;
  
  messages: string[] = [];
  
  // Neural network properties
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private animationFrame!: number;

  constructor(
    private openaiService: OpenaiService,
    private supabaseService: SupabaseService,
    private router: Router,
    private telemetryService: TelemetryService
  ) {}

  ngOnInit(): void {
    // Subscribe to current user
    this.supabaseService.user$.subscribe(async user => {
      console.log('User state changed:', user);
      this.currentUser = user;
      if (user) {
        // Extract name from email or use email
        const emailName = user.email?.split('@')[0] || 'User';
        // Capitalize first letter
        this.username = this.capitalizeFirstLetter(user.user_metadata?.['full_name'] || user.user_metadata?.['name'] || emailName);
        console.log('Username set to:', this.username);
        console.log('User email:', user.email);
        
        // Load user interests from database
        await this.loadUserInterests();
      }
    });
    
    // Set messages after we potentially have username
    setTimeout(() => {
      this.messages = [
        `Welcome ${this.username}!`,
        'Happy to assist you today.',
        'Advance your learning path.'
      ];
      this.startTypewriter();
    }, 100);
  }

  async loadUserInterests(): Promise<void> {
    if (!this.currentUser) return;

    try {
      const userInterests = await this.supabaseService.getUserInterests();
      this.interests = userInterests.map((interest: { id: string; name: string; created_at: string }) => interest.name);
      console.log('Loaded user interests:', this.interests);
      
      // Re-initialize neural network with new interests
      if (this.interests.length > 0) {
        setTimeout(() => {
          this.initNeuralNetwork();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading user interests:', error);
      // If database fails, keep empty array - user can add interests via UI
      this.interests = [];
    }
  }
  
  capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  ngAfterViewInit(): void {
    this.initNeuralNetwork();
  }

  ngOnDestroy(): void {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
    }
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  initNeuralNetwork(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Create nodes for each interest with dynamic sizing based on text length
    this.interests.forEach((interest, index) => {
      const angle = (index / this.interests.length) * Math.PI * 2;
      const radius = Math.min(this.canvas.width, this.canvas.height) * 0.3;
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      
      // Calculate radius based on text length (longer text = bigger circle)
      const textLength = interest.length;
      const minRadius = 40;
      const maxRadius = 80;
      const calculatedRadius = Math.min(maxRadius, minRadius + (textLength * 2.5));
      
      this.nodes.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        label: interest,
        radius: calculatedRadius
      });
    });
    
    this.animate();
  }

  resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  animate(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw brain silhouette in the background
    this.drawBrain();
    
    // Update node positions
    this.nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;
      
      // Bounce off edges
      if (node.x < node.radius || node.x > this.canvas.width - node.radius) {
        node.vx *= -1;
      }
      if (node.y < node.radius || node.y > this.canvas.height - node.radius) {
        node.vy *= -1;
      }
      
      // Keep nodes within bounds
      node.x = Math.max(node.radius, Math.min(this.canvas.width - node.radius, node.x));
      node.y = Math.max(node.radius, Math.min(this.canvas.height - node.radius, node.y));
    });
    
    // Draw connections
    this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.15)';
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[j].x - this.nodes[i].x;
        const dy = this.nodes[j].y - this.nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 400) {
          const opacity = 1 - (distance / 400);
          this.ctx.strokeStyle = `rgba(102, 126, 234, ${opacity * 0.3})`;
          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
          this.ctx.stroke();
        }
      }
    }
    
    // Draw nodes
    this.nodes.forEach(node => {
      // Draw outer glow
      const glowGradient = this.ctx.createRadialGradient(node.x, node.y, node.radius * 0.5, node.x, node.y, node.radius * 1.3);
      glowGradient.addColorStop(0, 'rgba(102, 126, 234, 0)');
      glowGradient.addColorStop(0.7, 'rgba(102, 126, 234, 0.05)');
      glowGradient.addColorStop(1, 'rgba(102, 126, 234, 0)');
      
      this.ctx.fillStyle = glowGradient;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius * 1.3, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw circle with gradient
      const gradient = this.ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius);
      gradient.addColorStop(0, 'rgba(102, 126, 234, 0.25)');
      gradient.addColorStop(0.5, 'rgba(118, 75, 162, 0.18)');
      gradient.addColorStop(1, 'rgba(102, 126, 234, 0.08)');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw border with pulsing effect
      const pulseIntensity = 0.3 + Math.sin(Date.now() / 1000 + node.x) * 0.15;
      this.ctx.strokeStyle = `rgba(102, 126, 234, ${pulseIntensity})`;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();
      
      // Draw inner circle (neuron core)
      const coreGradient = this.ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 0.3);
      coreGradient.addColorStop(0, 'rgba(118, 75, 162, 0.4)');
      coreGradient.addColorStop(1, 'rgba(102, 126, 234, 0.1)');
      
      this.ctx.fillStyle = coreGradient;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw text
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.font = '14px Poppins, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      // Wrap text if needed
      const words = node.label.split(' ');
      const lineHeight = 18;
      let y = node.y;
      
      if (words.length > 2) {
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');
        this.ctx.fillText(line1, node.x, y - lineHeight / 2);
        this.ctx.fillText(line2, node.x, y + lineHeight / 2);
      } else {
        this.ctx.fillText(node.label, node.x, y);
      }
    });
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  drawBrain(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const brainSize = Math.min(this.canvas.width, this.canvas.height) * 0.4;
    
    this.ctx.save();
    this.ctx.globalAlpha = 0.05;
    this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    this.ctx.lineWidth = 2;
    
    // Draw brain outline (simplified brain shape)
    this.ctx.beginPath();
    
    // Left hemisphere
    this.ctx.arc(centerX - brainSize * 0.15, centerY - brainSize * 0.1, brainSize * 0.35, Math.PI * 0.5, Math.PI * 1.5);
    
    // Top curves
    this.ctx.bezierCurveTo(
      centerX - brainSize * 0.3, centerY - brainSize * 0.5,
      centerX - brainSize * 0.1, centerY - brainSize * 0.6,
      centerX, centerY - brainSize * 0.55
    );
    
    this.ctx.bezierCurveTo(
      centerX + brainSize * 0.1, centerY - brainSize * 0.6,
      centerX + brainSize * 0.3, centerY - brainSize * 0.5,
      centerX + brainSize * 0.5, centerY - brainSize * 0.35
    );
    
    // Right hemisphere
    this.ctx.arc(centerX + brainSize * 0.15, centerY - brainSize * 0.1, brainSize * 0.35, Math.PI * 1.5, Math.PI * 0.5);
    
    // Bottom curves
    this.ctx.bezierCurveTo(
      centerX + brainSize * 0.4, centerY + brainSize * 0.3,
      centerX + brainSize * 0.2, centerY + brainSize * 0.4,
      centerX, centerY + brainSize * 0.35
    );
    
    this.ctx.bezierCurveTo(
      centerX - brainSize * 0.2, centerY + brainSize * 0.4,
      centerX - brainSize * 0.4, centerY + brainSize * 0.3,
      centerX - brainSize * 0.5, centerY - brainSize * 0.35
    );
    
    this.ctx.closePath();
    this.ctx.stroke();
    
    // Draw brain folds/sulci (curved lines inside)
    this.ctx.globalAlpha = 0.03;
    const folds = 8;
    for (let i = 0; i < folds; i++) {
      const angle = (i / folds) * Math.PI * 2;
      const startRadius = brainSize * 0.15;
      const endRadius = brainSize * 0.4;
      
      this.ctx.beginPath();
      this.ctx.moveTo(
        centerX + Math.cos(angle) * startRadius,
        centerY + Math.sin(angle) * startRadius * 0.8
      );
      
      const controlX1 = centerX + Math.cos(angle + 0.3) * (startRadius + endRadius) / 2;
      const controlY1 = centerY + Math.sin(angle + 0.3) * (startRadius + endRadius) / 2 * 0.8;
      const controlX2 = centerX + Math.cos(angle - 0.3) * (startRadius + endRadius) / 2;
      const controlY2 = centerY + Math.sin(angle - 0.3) * (startRadius + endRadius) / 2 * 0.8;
      
      this.ctx.bezierCurveTo(
        controlX1, controlY1,
        controlX2, controlY2,
        centerX + Math.cos(angle) * endRadius,
        centerY + Math.sin(angle) * endRadius * 0.8
      );
      
      this.ctx.stroke();
    }
    
    // Add corpus callosum (middle divider)
    this.ctx.globalAlpha = 0.04;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY - brainSize * 0.5);
    this.ctx.lineTo(centerX, centerY + brainSize * 0.3);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  startTypewriter(): void {
    this.typewriterInterval = setInterval(() => {
      const currentMessage = this.messages[this.currentMessageIndex];
      
      if (!this.isDeleting && this.currentCharIndex < currentMessage.length) {
        this.typewriterText += currentMessage.charAt(this.currentCharIndex);
        this.currentCharIndex++;
      } else if (!this.isDeleting && this.currentCharIndex === currentMessage.length) {
        setTimeout(() => {
          this.isDeleting = true;
        }, 2000);
      } else if (this.isDeleting && this.currentCharIndex > 0) {
        this.typewriterText = currentMessage.substring(0, this.currentCharIndex - 1);
        this.currentCharIndex--;
      } else if (this.isDeleting && this.currentCharIndex === 0) {
        this.isDeleting = false;
        this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messages.length;
      }
    }, this.isDeleting ? 50 : 100);
  }

  generateTip(): void {
    if (this.interests.length === 0) {
      this.generatedTip = 'Please add your interests by clicking on the "Interests" menu item above';
      return;
    }

    this.isLoading = true;
    this.generatedTip = '';
    this.isCohesive = false; // Reset cohesive state
    this.selectedInterests = [];

    this.openaiService.generateLearningTip(this.interests).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.choices && response.choices.length > 0) {
          this.generatedTip = response.choices[0].message.content;
          this.isCohesive = response.isCohesive || false;
          this.selectedInterests = response.selectedInterests || [];
          
          this.telemetryService.logTipGenerated(
            this.selectedInterests.join(',') || 'general',
            this.generatedTip,
            this.currentUser?.id
          );
          
          console.log('Tip generated:', {
            isCohesive: this.isCohesive,
            selectedInterests: this.selectedInterests
          });
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.telemetryService.logError('Tip generation failed', error, {
          'user.id': this.currentUser?.id || 'unknown',
          'interests.count': this.interests.length,
          'interests.list': this.interests.join(',')
        });
        this.generatedTip = 'Error generating tip. Please check your API key and try again.';
        this.isCohesive = false;
        console.error('Error:', error);
      }
    });
  }


}
