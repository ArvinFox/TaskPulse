import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { TaskService } from '../../core/services/task.service';
import { SignalrService } from '../../core/services/signalr.service';
import { TaskItem, TeamMember } from '../../core/models/task.model';
import { TaskDetailComponent } from './task-detail.component';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'subTaskFraction',
  standalone: true
})
export class SubTaskFractionPipe implements PipeTransform {
  transform(subtasks: any[]): string {
    if (!subtasks) return '0/0';
    const completed = subtasks.filter(s => s.isCompleted).length;
    return `${completed}/${subtasks.length}`;
  }
}

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule, TaskDetailComponent, SubTaskFractionPipe],
  templateUrl: './board.component.html',
  styleUrl: './board.component.css'
})
export class BoardComponent implements OnInit {
  tasks = signal<TaskItem[]>([]);
  members = signal<TeamMember[]>([]);
  isLoading = signal<boolean>(true);

  // New task quick-create state
  showQuickAdd = signal<{
    ToDo: boolean;
    InProgress: boolean;
    InReview: boolean;
    Done: boolean;
  }>({
    ToDo: false,
    InProgress: false,
    InReview: false,
    Done: false
  });
  quickTaskTitle = signal<{
    ToDo: string;
    InProgress: string;
    InReview: string;
    Done: string;
  }>({
    ToDo: '',
    InProgress: '',
    InReview: '',
    Done: ''
  });

  // Selected task state (for details modal)
  selectedTask = signal<TaskItem | null>(null);
  showDetailModal = signal<boolean>(false);

  // Split tasks into four columns reactively using Computed Signals
  todoTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'ToDo'));
  inProgressTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'InProgress'));
  inReviewTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'InReview'));
  doneTasks = computed(() => this.tasks().filter(t => t.columnStatus === 'Done'));

  constructor(
    private taskService: TaskService,
    private signalrService: SignalrService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.setupSignalRListeners();
  }

  loadData() {
    this.isLoading.set(true);
    this.taskService.getTasksForProject(1).subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load tasks', err);
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
    // 1. Real-time Task Move Broadcast
    this.signalrService.taskMoved$.subscribe(event => {
      // Find and update the task status locally
      this.tasks.update(current => {
        return current.map(t => t.id === event.taskId ? { ...t, columnStatus: event.newStatus } : t);
      });
    });

    // 2. Real-time Task Created Broadcast
    this.signalrService.taskCreated$.subscribe(task => {
      // Add if not already present
      if (!this.tasks().some(t => t.id === task.id)) {
        this.tasks.update(current => [...current, task]);
      }
    });

    // 3. Real-time Task Updated Broadcast
    this.signalrService.taskUpdated$.subscribe(task => {
      this.tasks.update(current => current.map(t => t.id === task.id ? task : t));
      
      // Update selected task in modal if it's the one that was updated
      if (this.selectedTask()?.id === task.id) {
        this.selectedTask.set(task);
      }
    });

    // 4. Real-time Task Deleted Broadcast
    this.signalrService.taskDeleted$.subscribe(taskId => {
      this.tasks.update(current => current.filter(t => t.id !== taskId));
      
      // Close details modal if open
      if (this.selectedTask()?.id === taskId) {
        this.closeDetails();
      }
    });
  }

  /// <summary>
  /// Handles Drag & Drop operations utilizing Angular CDK.
  /// Executes optimistic updates to the UI, performs API call, and triggers SignalR.
  /// </summary>
  onTaskDrop(event: CdkDragDrop<TaskItem[]>, targetStatus: 'ToDo' | 'InProgress' | 'InReview' | 'Done') {
    // If dropped in the same column, do nothing
    if (event.previousContainer === event.container) {
      return;
    }

    const taskToMove = event.previousContainer.data[event.previousIndex];
    if (!taskToMove || !taskToMove.id) return;

    const previousStatus = taskToMove.columnStatus;
    
    // --- OPTIMISTIC UPDATE ---
    // Instantly modify the column state locally so the user experiences zero lag.
    taskToMove.columnStatus = targetStatus;
    this.tasks.update(current => current.map(t => t.id === taskToMove.id ? { ...t, columnStatus: targetStatus } : t));

    // Send HTTP PUT request to save status in SQLite Db
    this.taskService.moveTask(taskToMove.id, targetStatus).subscribe({
      next: () => {
        // Broadcast the move to other clients via SignalR
        this.signalrService.broadcastTaskMoved(taskToMove.id!, targetStatus, 'User');
      },
      error: (err) => {
        console.error('Failed to move task on server', err);
        // Rollback state in case of server failure
        taskToMove.columnStatus = previousStatus;
        this.tasks.update(current => current.map(t => t.id === taskToMove.id ? { ...t, columnStatus: previousStatus } : t));
      }
    });
  }

  // Quick add handlers
  toggleQuickAdd(column: 'ToDo' | 'InProgress' | 'InReview' | 'Done') {
    this.showQuickAdd.update(curr => ({ ...curr, [column]: !curr[column] }));
  }

  submitQuickAdd(column: 'ToDo' | 'InProgress' | 'InReview' | 'Done') {
    const title = this.quickTaskTitle()[column]?.trim();
    if (!title) return;

    const newTask: TaskItem = {
      title,
      columnStatus: column,
      storyPoints: 1, // default
      projectId: 1,  // default seeded project
      subTasks: []
    };

    this.taskService.createTask(newTask).subscribe({
      next: (createdTask) => {
        this.tasks.update(curr => [...curr, createdTask]);
        
        // Reset input state
        this.quickTaskTitle.update(curr => ({ ...curr, [column]: '' }));
        this.showQuickAdd.update(curr => ({ ...curr, [column]: false }));
      },
      error: (err) => console.error('Failed to create task', err)
    });
  }

  // Modal actions
  openDetails(task: TaskItem) {
    this.selectedTask.set(task);
    this.showDetailModal.set(true);
  }

  closeDetails() {
    this.selectedTask.set(null);
    this.showDetailModal.set(false);
  }

  onTaskSaved(savedTask: TaskItem) {
    this.tasks.update(curr => curr.map(t => t.id === savedTask.id ? savedTask : t));
    this.closeDetails();
  }

  onTaskDeleted(taskId: number) {
    this.tasks.update(curr => curr.filter(t => t.id !== taskId));
    this.closeDetails();
  }
}
