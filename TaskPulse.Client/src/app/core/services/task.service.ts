import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BoardProject, TeamMember, TaskItem } from '../models/task.model';

/// <summary>
/// Service to handle standard HTTP REST communications with the backend Web API.
/// Utilizing Angular Dependency Injection and modern HttpClient.
/// </summary>
@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = 'https://taskpulse-api-15zs.onrender.com/api';

  constructor(private http: HttpClient) {}

  // Fetch all board projects
  getProjects(): Observable<BoardProject[]> {
    return this.http.get<BoardProject[]>(`${this.apiUrl}/projects`);
  }

  // Fetch all tasks for a specific project
  getTasksForProject(projectId: number): Observable<TaskItem[]> {
    return this.http.get<TaskItem[]>(`${this.apiUrl}/projects/${projectId}/tasks`);
  }

  // Create a new task
  createTask(task: TaskItem): Observable<TaskItem> {
    return this.http.post<TaskItem>(`${this.apiUrl}/tasks`, task);
  }

  // Update details of a task (title, desc, points, subtasks)
  updateTask(id: number, task: TaskItem): Observable<TaskItem> {
    return this.http.put<TaskItem>(`${this.apiUrl}/tasks/${id}`, task);
  }

  // Optimised Drag and Drop state update
  moveTask(id: number, newStatus: string): Observable<any> {
    // Send status string directly in the body (as JSON string)
    return this.http.put<any>(`${this.apiUrl}/tasks/${id}/move`, JSON.stringify(newStatus), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Delete a task
  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${id}`);
  }

  // Fetch list of available team members
  getMembers(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.apiUrl}/members`);
  }
}
