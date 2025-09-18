// Test ONNX Runtime import
console.log('Testing ONNX Runtime import...');

import * as ort from 'onnxruntime-web';

console.log('ONNX Runtime imported:', {
  InferenceSession: typeof ort.InferenceSession,
  Tensor: typeof ort.Tensor,
  env: typeof ort.env,
  available: ort.InferenceSession !== undefined
});

export default ort;