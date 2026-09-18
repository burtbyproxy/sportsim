/**
 * Simulation Worker — runs the simulation off the main thread. What it runs
 * is simulation-local.js; this file only puts it behind a Comlink port.
 */
import { expose } from 'comlink'
import { simulationLocal } from './simulation-local.js'

expose(simulationLocal)
