import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { TaskItem } from '../models/task.model';

/// <summary>
/// Service to manage client WebSocket connections using SignalR client.
/// This connects to our .NET hub route ("/hubs/tasks") and exposes RxJS subjects
/// so UI components can subscribe to live updates.
/// </summary>
@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private hubConnection!: signalR.HubConnection;
  private hubUrl = 'http://localhost:5205/hubs/tasks';

  // RxJS Subjects to stream events out to UI components
  private taskMovedSubject = new Subject<{ taskId: number; newStatus: 'ToDo' | 'InProgress' | 'InReview' | 'Done' }>();
  private taskCreatedSubject = new Subject<TaskItem>();
  private taskUpdatedSubject = new Subject<TaskItem>();
  private taskDeletedSubject = new Subject<number>();

  // Public Observables that components can subscribe to
  taskMoved$: Observable<{ taskId: number; newStatus: 'ToDo' | 'InProgress' | 'InReview' | 'Done' }> = this.taskMovedSubject.asObservable();
  taskCreated$: Observable<TaskItem> = this.taskCreatedSubject.asObservable();
  taskUpdated$: Observable<TaskItem> = this.taskUpdatedSubject.asObservable();
  taskDeleted$: Observable<number> = this.taskDeletedSubject.asObservable();

  constructor() {
    this.startConnection();
  }

  /// <summary>
  /// Configures and initiates the WebSocket connection.
  /// </summary>
  private startConnection() {
    // Build connection with automatic reconnect policies
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Start connection
    this.hubConnection
      .start()
      .then(() => console.log('SignalR Connection started successfully.'))
      .catch(err => {
        console.error('Error while starting SignalR connection: ', err);
        // Retry connection after 5 seconds if initial start fails
        setTimeout(() => this.startConnection(), 5000);
      });

    // Register listeners mapping to the Hub callbacks in Hubs/TaskHub.cs
    this.registerListeners();
  }

  /// <summary>
  /// Maps SignalR hub events to RxJS subjects.
  /// </summary>
  private registerListeners() {
    // When a task is moved
    this.hubConnection.on('TaskMoved', (taskId: number, newStatus: 'ToDo' | 'InProgress' | 'InReview' | 'Done') => {
      this.taskMovedSubject.next({ taskId, newStatus });
    });

    // When a task is created
    this.hubConnection.on('TaskCreated', (task: TaskItem) => {
      this.taskCreatedSubject.next(task);
    });

    // When a task is updated
    this.hubConnection.on('TaskUpdated', (task: TaskItem) => {
      this.taskUpdatedSubject.next(task);
    });

    // When a task is deleted
    this.hubConnection.on('TaskDeleted', (taskId: number) => {
      this.taskDeletedSubject.next(taskId);
    });
  }

  /// <summary>
  /// Direct method to invoke hub broadcasts from client side if required.
  /// Note: We mostly invoke edits via REST API, but this is here for showcase.
  /// </summary>
  broadcastTaskMoved(taskId: number, newStatus: string, user: string) {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('NotifyTaskMoved', taskId, newStatus, user)
        .catch(err => console.error(err));
    }
  }
}
