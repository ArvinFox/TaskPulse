import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { TaskItem, TeamMember, SubTaskItem } from '../../core/models/task.model';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.css'
})
export class TaskDetailComponent implements OnInit {
  @Input() task: TaskItem | null = null;
  @Input() members: TeamMember[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TaskItem>();
  @Output() deleted = new EventEmitter<number>();

  // Local component states
  editTitle = '';
  editDescription = '';
  editPoints = 1;
  editMemberId: number | null = null;
  editStatus: 'ToDo' | 'InProgress' | 'InReview' | 'Done' = 'ToDo';
  localSubtasks: SubTaskItem[] = [];
  newSubtaskTitle = '';

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    if (this.task) {
      // Create copies of task details so we don't modify the board model directly 
      // until they click the 'Save' button. This is standard form handling.
      this.editTitle = this.task.title;
      this.editDescription = this.task.description || '';
      this.editPoints = this.task.storyPoints;
      this.editMemberId = this.task.assignedMemberId || null;
      this.editStatus = this.task.columnStatus;
      this.localSubtasks = this.task.subTasks ? this.task.subTasks.map(s => ({ ...s })) : [];
    }
  }

  // Subtask actions
  toggleSubtask(subtask: SubTaskItem) {
    subtask.isCompleted = !subtask.isCompleted;
  }

  addSubtask() {
    const title = this.newSubtaskTitle.trim();
    if (!title) return;

    this.localSubtasks.push({
      title,
      isCompleted: false,
      taskItemId: this.task?.id
    });
    this.newSubtaskTitle = '';
  }

  removeSubtask(index: number) {
    this.localSubtasks.splice(index, 1);
  }



  // Save changes back to SQLite database via REST API
  saveTask() {
    if (!this.task || !this.task.id) return;

    const updatedTask: TaskItem = {
      ...this.task,
      title: this.editTitle,
      description: this.editDescription,
      storyPoints: this.editPoints,
      assignedMemberId: this.editMemberId,
      columnStatus: this.editStatus,
      subTasks: this.localSubtasks
    };

    this.taskService.updateTask(this.task.id, updatedTask).subscribe({
      next: (saved) => {
        this.saved.emit(saved);
      },
      error: (err) => console.error('Failed to save task modifications', err)
    });
  }

  // Delete task completely from db
  deleteTask() {
    if (!this.task || !this.task.id) return;

    if (confirm('Are you sure you want to delete this task?')) {
      this.taskService.deleteTask(this.task.id).subscribe({
        next: () => {
          this.deleted.emit(this.task!.id!);
        },
        error: (err) => console.error('Failed to delete task', err)
      });
    }
  }
}
