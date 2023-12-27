const { mockRequest, mockResponse } = require('mock-req-res');
const { pipeline } = require('stream');
const fetch = require('node-fetch');
const { reverseProxyFunc } = require('./server');

jest.mock('node-fetch');

const from_url = 'http://10.1.3.10:7680'
const body = `{"width":256,"height":256,"seed":-1,"steps":28,"cfg_scale":7,"prompt":"perfect eyes,texured skin,perfect body,detailed eyes,extremely detailed,very detailed clothes,\n(highres),(best quality:0.9),illustration,ultra detail,full body,solo,hdr,masterpiece,best quality,\ncinematic lighting,Hyperrealism,depth of field,photography,ultra highres,photorealistic,8k,hyperrealism,studio lighting,photography,\nblack medium hair,beautiful detailed eyes,bouncing breasts,black choker,earrings,hair_ornament,expressionless,\nlooking at viewer,eyes closed,(realistic:1.2),(big breasts:1.3),\nblack tailored suit jacket,white shirt,\nstanding at attention,\nupper body,straight on,\nwild-eyed masochistin heat","negative_prompt":"bad anatomy,(worst quality:2),(low quality:2),(lowres:2),(grayscale:1.2),ugly,sketch,3d,oilpainting,bad anatomy,(worst quality:2),(low quality:2),(lowres:2),(grayscale:1.2),ugly,sketch,3d,oil painting","sampler_name":"DPM++ 2M Karras","enable_hr":false,"denoising_strength":0.7,"hr_scale":1.25,"hr_upscaler":"Latent"}`

describe('reverseProxyFunc', () => {
  it('should make request to original server and send response to client', async () => {
    const req = mockRequest({
      headers: {
        'risu-url': from_url,
        'risu-header': JSON.stringify({ 'Content-Type': 'application/json' }),
      },
      method: 'POST',
      body
    });
    const res = mockResponse();
    const originalResponse = {
      status: 200,
      headers: new Map([
        ['Content-Type', 'application/json'],
        ['Cache-Control', 'no-cache'],
      ]),
      body: {
        pipe: jest.fn(),
      },
    };
    fetch.mockResolvedValue(originalResponse);
    pipeline.mockImplementation((source, destination, callback) => {
      callback();
    });

    await reverseProxyFunc(req, res);

    expect(fetch).toHaveBeenCalledWith("http://localhost:3000", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    expect(res.header).toHaveBeenCalledWith({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(pipeline).toHaveBeenCalledWith(originalResponse.body, res);
  });

//   it('should handle errors and call the error handling middleware', async () => {
//     const req = mockRequest({
//       headers: {
//         'risu-url': 'https://example.com',
//       },
//     });
//     const res = mockResponse();
//     const next = jest.fn();
//     const error = new Error('Request failed');
//     fetch.mockRejectedValue(error);

//     await reverseProxyFunc(req, res, next);

//     expect(next).toHaveBeenCalledWith(error);
//   });
});