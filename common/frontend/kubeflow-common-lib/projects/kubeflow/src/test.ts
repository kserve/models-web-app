// This file is required by karma.conf.js and initializes the Angular testing
// environment. The Karma builder discovers the .spec files itself.

import 'zone.js';
import 'zone.js/testing';
import '@angular/localize/init';
import { NgModule, provideZoneChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Angular defaults to zoneless change detection; the applications consuming
// this library run with Zone.js, so the tests do as well.
@NgModule({ providers: [provideZoneChangeDetection()] })
class ZoneChangeDetectionTestingModule {}

getTestBed().initTestEnvironment(
  [BrowserDynamicTestingModule, ZoneChangeDetectionTestingModule],
  platformBrowserDynamicTesting(),
);
