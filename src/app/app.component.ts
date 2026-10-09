import { ChangeDetectionStrategy, Component } from "@angular/core";
import { UniRideComponent } from "./components/uniride/uniride.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [UniRideComponent],
  template: "<app-uniride />",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
