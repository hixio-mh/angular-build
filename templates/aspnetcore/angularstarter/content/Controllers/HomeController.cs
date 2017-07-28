using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.NodeServices;
using Microsoft.AspNetCore.SpaServices.Prerendering;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Threading;
using Company.AspNetCoreNgStarter1.Models;

namespace Company.AspNetCoreNgStarter1.Controllers
{
    public class HomeController : Controller
    {
        private readonly SpaOptions _spaOptions;

        public HomeController(IOptions<SpaOptions> spaOptionsAccessor)
        {
            _spaOptions = spaOptionsAccessor.Value;
        }


        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            var hostEnv = Request.HttpContext.RequestServices.GetRequiredService<IHostingEnvironment>();
            var preRenderEnabled = _spaOptions.PreRenderEnabled && !string.IsNullOrWhiteSpace(_spaOptions.PreRenderModule);
            ViewData["PreRenderEnabled"] = preRenderEnabled;
            if (!preRenderEnabled)
            {
                return View();
            }

            var nodeServices = Request.HttpContext.RequestServices.GetRequiredService<INodeServices>();

            var applicationBasePath = hostEnv.ContentRootPath; // C:\\Users\\...
            var requestFeature = Request.HttpContext.Features.Get<IHttpRequestFeature>();
            var unencodedPathAndQuery = requestFeature.RawTarget; // '/'
            var unencodedAbsoluteUrl = $"{Request.Scheme}://{Request.Host}{unencodedPathAndQuery}"; // http://localhost:6496/

            if (!_spaOptions.PreRenderModule.StartsWith("/"))
            {
                _spaOptions.PreRenderModule = "/" + _spaOptions.PreRenderModule;
            }

            // By default we're passing down Cookies, Headers, Host from the Request object here
            var prerenderCustomData = new PrerenderCustomData
            {
                Request = new AbstractRequest
                {
                    Cookies = Request.Cookies,
                    Headers = Request.Headers,
                    Host = Request.Host
                },
                ServerData = new
                {
                    TransferData = new Dictionary<string, object> { { "greeting", "Hi this is from ASP.Net. :)" } }
                    // LocalStorageProvided = Request.Cookies.ContainsKey("LOCAL_STORAGE")
                }
            };
            // Add more customData here, add it to the TransferData class

            // Prerender / Serialize application (with Universal)
            var prerenderResult = await Prerenderer.RenderToString(
                "/",
                nodeServices,
                cancellationToken,
                new JavaScriptModuleExport(applicationBasePath + _spaOptions.PreRenderModule),
                unencodedAbsoluteUrl,
                unencodedPathAndQuery,
                prerenderCustomData, // Our simplified Request object & any other CustommData you want to send!
                30000,
                Request.PathBase.ToString()
            );

            ViewData["SpaHtml"] = prerenderResult.Html; // our <app> from Angular
            ViewData["Title"] = prerenderResult.Globals["title"]; // set our <title> from Angular
            ViewData["Styles"] = prerenderResult.Globals["styles"]; // put styles in the correct place
            ViewData["Meta"] = prerenderResult.Globals["meta"]; // set our <meta> SEO tags
            ViewData["Links"] = prerenderResult.Globals["links"]; // set our <link rel="canonical"> etc SEO tags
            ViewData["TransferData"] = prerenderResult.Globals["transferData"]; // our transfer data set to window.TRANSFER_CACHE = {};

            return View();
        }

        public IActionResult Error()
        {
            ViewData["RequestId"] = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
            return View();
        }
    }
}
