// Allow importing .css files (global styles + CSS modules) under raw tsc.
// Metro handles these at bundle time; this only satisfies the typechecker.
declare module '*.css';
