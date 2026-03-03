import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AdminUserUpdatePayload, AuthUser } from '../../../../core/models/auth';
import { ConfigurationService } from '../../../../core/services/configuration.service';

interface EditUserDialogData {
  user: AuthUser;
}

@Component({
  selector: 'app-edit-user-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule
  ],
  templateUrl: './edit-user-dialog.html',
  styleUrl: './edit-user-dialog.scss'
})
export class EditUserDialogComponent {
  private readonly config = inject(ConfigurationService);
  protected readonly dialogRef = inject(MatDialogRef<EditUserDialogComponent, AdminUserUpdatePayload | undefined>);
  protected readonly data = inject<EditUserDialogData>(MAT_DIALOG_DATA);

  protected readonly firstNameControl = new FormControl(this.data.user.firstName, {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinNameLength), Validators.maxLength(this.config.authMaxNameLength)]
  });

  protected readonly lastNameControl = new FormControl(this.data.user.lastName, {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinNameLength), Validators.maxLength(this.config.authMaxNameLength)]
  });

  protected readonly phoneControl = new FormControl(this.data.user.phone, {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(this.config.authPhonePattern), Validators.maxLength(this.config.authMaxPhoneLength)]
  });

  protected readonly ageControl = new FormControl(this.data.user.age, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(this.config.authMinAge), Validators.max(this.config.authMaxAge)]
  });

  protected readonly roleControl = new FormControl<'user' | 'admin'>(this.data.user.role, { nonNullable: true });
  protected readonly emailVerifiedControl = new FormControl(this.data.user.emailVerified, { nonNullable: true });

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  protected submit(): void {
    if (
      this.firstNameControl.invalid
      || this.lastNameControl.invalid
      || this.phoneControl.invalid
      || this.ageControl.invalid
    ) {
      this.firstNameControl.markAsTouched();
      this.lastNameControl.markAsTouched();
      this.phoneControl.markAsTouched();
      this.ageControl.markAsTouched();
      return;
    }

    this.dialogRef.close({
      firstName: this.firstNameControl.value,
      lastName: this.lastNameControl.value,
      phone: this.phoneControl.value,
      age: this.ageControl.value,
      role: this.roleControl.value,
      emailVerified: this.emailVerifiedControl.value
    });
  }
}
