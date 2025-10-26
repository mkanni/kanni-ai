import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
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
  selector: 'app-interests',
  templateUrl: './interests.component.html',
  styleUrls: ['./interests.component.scss']
})
export class InterestsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('networkCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  currentUser: User | null = null;
  username: string = '';
  interests: string[] = [];
  newInterest: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;

  // Neural network properties
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private animationFrame!: number;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.supabaseService.user$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        // Extract name from email or use email
        const emailName = user.email?.split('@')[0] || 'User';
        // Capitalize first letter
        this.username = this.capitalizeFirstLetter(user.user_metadata?.['full_name'] || user.user_metadata?.['name'] || emailName);
        this.loadUserInterests();
      }
    });
  }

  capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  ngAfterViewInit(): void {
    this.initNeuralNetwork();
  }

  ngOnDestroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  async loadUserInterests(): Promise<void> {
    if (!this.currentUser) return;

    this.isLoading = true;
    try {
      const userInterests = await this.supabaseService.getUserInterests();
      this.interests = userInterests.map((interest: { id: string; name: string; created_at: string }) => interest.name);
      
      // Refresh neural network with new interests
      setTimeout(() => {
        this.refreshNeuralNetwork();
      }, 100);
    } catch (error) {
      console.error('Error loading interests:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async addInterest(): Promise<void> {
    if (!this.newInterest.trim() || !this.currentUser) return;

    const interest = this.newInterest.trim();
    if (this.interests.includes(interest)) {
      alert('This interest already exists!');
      return;
    }

    this.isSaving = true;
    try {
      await this.supabaseService.addUserInterest(interest);
      this.interests.push(interest);
      this.newInterest = '';
      
      // Refresh neural network with new interest
      setTimeout(() => {
        this.refreshNeuralNetwork();
      }, 100);
    } catch (error) {
      console.error('Error adding interest:', error);
      alert('Failed to add interest. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  async removeInterest(interest: string): Promise<void> {
    if (!this.currentUser) return;

    this.isSaving = true;
    try {
      await this.supabaseService.removeUserInterest(interest);
      this.interests = this.interests.filter(i => i !== interest);
      
      // Refresh neural network after removing interest
      setTimeout(() => {
        this.refreshNeuralNetwork();
      }, 100);
    } catch (error) {
      console.error('Error removing interest:', error);
      alert('Failed to remove interest. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  async logout(): Promise<void> {
    try {
      const { error } = await this.supabaseService.signOut();
      if (!error) {
        this.router.navigate(['/login']);
      } else {
        console.error('Error logging out:', error);
        alert('Failed to logout. Please try again.');
      }
    } catch (error) {
      console.error('Exception during logout:', error);
      alert('Failed to logout. Please try again.');
    }
  }

  getUserInitials(): string {
    if (!this.currentUser) return '??';
    
    const email = this.currentUser.email || '';
    if (email.length > 0) {
      const namePart = email.split('@')[0];
      if (namePart.length > 1) {
        return namePart.substring(0, 2).toUpperCase();
      }
      return email.substring(0, 2).toUpperCase();
    }
    
    return 'U';
  }

  // Neural network methods (similar to home page)
  initNeuralNetwork(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Create nodes for each interest with dynamic sizing based on text length
    this.interests.forEach((interest, index) => {
      const angle = (index / Math.max(this.interests.length, 1)) * Math.PI * 2;
      const radius = Math.min(this.canvas.width, this.canvas.height) * 0.25;
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      
      // Calculate radius based on text length (longer text = bigger circle)
      const textLength = interest.length;
      const minRadius = 30;
      const maxRadius = 60;
      const calculatedRadius = Math.min(maxRadius, minRadius + (textLength * 1.5));
      
      this.nodes.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
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
    this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[j].x - this.nodes[i].x;
        const dy = this.nodes[j].y - this.nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 300) {
          const opacity = 1 - (distance / 300);
          this.ctx.strokeStyle = `rgba(102, 126, 234, ${opacity * 0.2})`;
          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
          this.ctx.stroke();
        }
      }
    }
    
    // Draw nodes
    this.nodes.forEach(node => {
      // Draw circle with gradient
      const gradient = this.ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius);
      gradient.addColorStop(0, 'rgba(102, 126, 234, 0.2)');
      gradient.addColorStop(0.5, 'rgba(118, 75, 162, 0.15)');
      gradient.addColorStop(1, 'rgba(102, 126, 234, 0.05)');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw border with pulsing effect
      const pulseIntensity = 0.2 + Math.sin(Date.now() / 1000 + node.x) * 0.1;
      this.ctx.strokeStyle = `rgba(102, 126, 234, ${pulseIntensity})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      
      // Draw text
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this.ctx.font = '12px Poppins, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      // Wrap text if needed
      const words = node.label.split(' ');
      const lineHeight = 14;
      let y = node.y;
      
      if (words.length > 1) {
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
    const brainSize = Math.min(this.canvas.width, this.canvas.height) * 0.3;
    
    this.ctx.save();
    this.ctx.globalAlpha = 0.03;
    this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.2)';
    this.ctx.lineWidth = 1;
    
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
    
    this.ctx.restore();
  }

  refreshNeuralNetwork(): void {
    // Clear existing nodes
    this.nodes = [];
    
    // Reinitialize with current interests
    if (this.canvas && this.ctx) {
      this.initNeuralNetwork();
    }
  }
}