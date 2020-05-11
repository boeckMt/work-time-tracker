import { Component, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-info-dialog',
  templateUrl: './info-dialog.component.html',
  styleUrls: ['./info-dialog.component.css']
})
export class InfoDialogComponent {
  saveClose = true;
  constructor(public dialogRef: MatDialogRef<InfoDialogComponent>) { }

  onNoClick(): void {
    this.dialogRef.close();
  }

}
