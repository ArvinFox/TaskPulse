import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { SignalrService } from '../../core/services/signalr.service';
import { TaskItem, TeamMember } from '../../core/models/task.model';

interface ActivityLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  protected readonly Math = Math;
  // Signals for state management
  tasks = signal<TaskItem[]>([]);
  members = signal<TeamMember[]>([]);
  activities = signal<ActivityLog[]>([]);
  isLoading = signal<boolean>(true);

  // Computed signals (derived state)
  totalTasks = computed(() => this.tasks().length);
  completedTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'Done').length);
  inProgressTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'InProgress').length);
  inReviewTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'InReview').length);
  todoTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'ToDo').length);

  totalStoryPoints = computed(() => this.tasks().reduce((sum, t) => sum + t.storyPoints, 0));
  completedStoryPoints = computed(() => this.tasks().filter(t => t.columnStatus === 'Done').reduce((sum, t) => sum + t.storyPoints, 0));

  completionPercentage = computed(() => {
    const total = this.totalTasks();
    if (total === 0) return 0;
    return Math.round((this.completedTasks() / total) * 100);
  });

  // Calculate coordinates for the SVG donut chart
  // Representing [ToDo, InProgress, InReview, Done]
  donutSegments = computed(() => {
    const todo = this.todoTasks();
    const progress = this.inProgressTasks();
    const review = this.inReviewTasks();
    const done = this.completedTasks();
    const total = todo + progress + review + done;

    if (total === 0) return [];

    const segments = [
      { count: todo, color: '#6B7280', label: 'To Do' },
      { count: progress, color: '#06B6D4', label: 'In Progress' },
      { count: review, color: '#F59E0B', label: 'In Review' },
      { count: done, color: '#10B981', label: 'Done' }
    ];

    let accumulatedPercentage = 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;

    return segments.map(seg => {
      const percentage = (seg.count / total) * 100;
      const strokeLength = (seg.count / total) * circumference;
      const strokeOffset = circumference - (accumulatedPercentage / 100) * circumference;
      accumulatedPercentage += percentage;

      return {
        ...seg,
        percentage: Math.round(percentage),
        strokeDash: `${strokeLength} ${circumference - strokeLength}`,
        strokeOffset: strokeOffset
      };
    }).filter(s => s.count > 0);
  });

  // Calculate coordinates for SVG burn-down line chart
  burnDownPoints = computed(() => {
    // Mocking 7 days burndown based on tasks list
    const totalPoints = this.totalStoryPoints();
    const completed = this.completedStoryPoints();
    const days = 7;
    const coordinates: string[] = [];

    // Let's generate a realistic-looking line path connecting the points
    // SVG width: 500, height: 150
    const stepX = 500 / (days - 1);
    
    // Seed points for illustration of progress
    const pointsData = [
      totalPoints,
      totalPoints - Math.round(completed * 0.1),
      totalPoints - Math.round(completed * 0.25),
      totalPoints - Math.round(completed * 0.4),
      totalPoints - Math.round(completed * 0.65),
      totalPoints - Math.round(completed * 0.85),
      totalPoints - completed
    ];

    pointsData.forEach((val, index) => {
      const x = index * stepX;
      // Map points range to SVG height (leaving margins)
      const ratio = totalPoints > 0 ? val / totalPoints : 0;
      const y = 130 - (ratio * 100); // 130 is near bottom, 30 is near top
      coordinates.push(`${x},${y}`);
    });

    return {
      path: `M ${coordinates.join(' L ')}`,
      dots: coordinates.map((coord, i) => {
        const parts = coord.split(',');
        return { x: parseFloat(parts[0]), y: parseFloat(parts[1]), val: pointsData[i] };
      })
    };
  });

  constructor(
    private taskService: TaskService,
    private signalrService: SignalrService
  ) {
    // Add initial dashboard load log
    this.logActivity('Welcome to TaskPulse dashboard. System initialized.', 'info');
  }

  ngOnInit(): void {
    this.loadData();
    this.setupSignalRListeners();
  }

  loadData() {
    this.isLoading.set(true);
    // Fetch project tasks (using projectId = 1 seeded by db)
    this.taskService.getTasksForProject(1).subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load tasks', err);
        this.logActivity('Error connecting to task database.', 'error');
        this.isLoading.set(false);
      }
    });

    this.taskService.getMembers().subscribe({
      next: (data) => {
        this.members.set(data);
      },
      error: (err) => console.error(err)
    });
  }

  private setupSignalRListeners() {
    // Listen to real-time events and reactively update local lists
    this.signalrService.taskMoved$.subscribe(event => {
      this.tasks.update(curr => {
        return curr.map(t => t.id === event.taskId ? { ...t, columnStatus: event.newStatus } : t);
      });
      
      const movedTask = this.tasks().find(t => t.id === event.taskId);
      if (movedTask) {
        this.logActivity(`Task "${movedTask.title}" was moved to ${event.newStatus}.`, 'info');
      }
    });

    this.signalrService.taskCreated$.subscribe(task => {
      this.tasks.update(curr => [...curr, task]);
      this.logActivity(`New task "${task.title}" was created.`, 'success');
    });

    this.signalrService.taskUpdated$.subscribe(task => {
      this.tasks.update(curr => curr.map(t => t.id === task.id ? task : t));
      this.logActivity(`Task "${task.title}" details were updated.`, 'warning');
    });

    this.signalrService.taskDeleted$.subscribe(taskId => {
      const deletedTask = this.tasks().find(t => t.id === taskId);
      this.tasks.update(curr => curr.filter(t => t.id !== taskId));
      if (deletedTask) {
        this.logActivity(`Task "${deletedTask.title}" was deleted.`, 'error');
      }
    });
  }

  private logActivity(message: string, type: 'info' | 'success' | 'warning' | 'error') {
    const newActivity: ActivityLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      message,
      type
    };
    
    // Add to top of list, capping at 10 items
    this.activities.update(current => [newActivity, ...current].slice(0, 10));
  }
}
