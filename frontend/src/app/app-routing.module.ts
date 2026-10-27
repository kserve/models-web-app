import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IndexComponent } from './pages/index/index.component';
import { ServerInfoComponent } from './pages/server-info/server-info.component';
import { SubmitFormComponent } from './pages/submit-form/submit-form.component';
import { InferenceGraphComponent } from './pages/inference-graph/inference-graph.component';
import { LLMInferenceServiceComponent } from './pages/llm-inference-service/llm-inference-service.component';
import { LLMDetailsComponent } from './pages/llm-inference-service/llm-details/llm-details.component';
import { GraphFormComponent } from './pages/inference-graph/graph-form/graph-form.component';
import { GraphInfoComponent } from './pages/inference-graph/graph-info/graph-info.component';

const routes: Routes = [
  { path: '', component: IndexComponent },
  { path: 'details/:namespace/:name', component: ServerInfoComponent },
  { path: 'new', component: SubmitFormComponent },
  { path: 'inference-graphs', component: InferenceGraphComponent },
  { path: 'llm-inference-services', component: LLMInferenceServiceComponent },
  { path: 'llm-details/:namespace/:name', component: LLMDetailsComponent },
  { path: 'new-graph', component: GraphFormComponent },
  { path: 'edit-graph/:namespace/:name', component: GraphFormComponent },
  { path: 'graph-details/:namespace/:name', component: GraphInfoComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
