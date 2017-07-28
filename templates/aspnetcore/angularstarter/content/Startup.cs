using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Company.AspNetCoreNgStarter1.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.SpaServices.Webpack;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Company.AspNetCoreNgStarter1
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            // Adds services required for using options.
            services.AddOptions();
            services.Configure<SpaOptions>(Configuration.GetSection("Spa"));

            // Add the localization services to the services container
            services.AddLocalization(options => options.ResourcesPath = "Resources");

            services.AddNodeServices();
            //services.AddNodeServices(options =>
            //{
            //    options.LaunchWithDebugging = true;
            //    options.DebuggingPort = 9229;
            //});

            // Add framework services.
            services.AddMvc()
                // Add support for finding localized views, based on file name suffix, e.g. Index.fr.cshtml
                .AddViewLocalization()
                // Add support for localizing strings in data annotations (e.g. validation messages) via the
                // IStringLocalizer abstractions.
                .AddDataAnnotationsLocalization();

            //services.AddAntiforgery(options => options.HeaderName = "X-XSRF-TOKEN");

            //services.Configure<MvcOptions>(options =>
            //{
            //    //var formatter = new JsonInputFormatter();
            //    //formatter.SupportedMediaTypes.Add(MediaTypeHeaderValue.Parse("application/csp-report"));
            //    //options.InputFormatters.RemoveType<JsonInputFormatter>();
            //    //options.InputFormatters.Add(formatter);
            //    options.InputFormatters.OfType<JsonInputFormatter>().First().SupportedMediaTypes.Add(
            //        new MediaTypeHeaderValue("application/csp-report")
            //    );
            //});

            // Configure supported cultures and localization options
            var localizationOptions = Configuration.GetSection("Localization").Get<LocalizationOptions>() ?? new LocalizationOptions();

            services.Configure<RequestLocalizationOptions>(options =>
            {
                var supportedCultures = localizationOptions.AvailableLanguages.Select(l => new CultureInfo(l))
                    .ToList();

                // State what the default culture for your application is. This will be used if no specific culture
                // can be determined for a given request.
                options.DefaultRequestCulture = new RequestCulture(localizationOptions.DefaultLanguage, localizationOptions.DefaultLanguage);

                // You must explicitly state which cultures your application supports.
                // These are the cultures the app supports for formatting numbers, dates, etc.
                options.SupportedCultures = supportedCultures;

                // These are the cultures the app supports for UI strings, i.e. we have localized resources for.
                options.SupportedUICultures = supportedCultures;

                // You can change which providers are configured to determine the culture for requests, or even add a custom
                // provider with your own logic. The providers will be asked in order to provide a culture for each request,
                // and the first to provide a non-null result that is in the configured supported cultures list will be used.
                // By default, the following built-in providers are configured:
                // - QueryStringRequestCultureProvider, sets culture via "culture" and "ui-culture" query string values, useful for testing
                // - CookieRequestCultureProvider, sets culture via "ASPNET_CULTURE" cookie
                // - AcceptLanguageHeaderRequestCultureProvider, sets culture via the "Accept-Language" request header
                //options.RequestCultureProviders.Insert(0, new CustomRequestCultureProvider(async context =>
                //{
                //  // My custom request culture logic
                //  return new ProviderCultureResult("en");
                //}));
            });

            // Register the Swagger generator, defining one or more Swagger documents
            //services.AddSwaggerGen(c =>
            //{
            //    c.SwaggerDoc("v1", new Info { Title = "Angular 4.0 Universal & ASP.NET Core web API", Version = "v1" });
            //});
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env)
        {
            // Spa options
            var spaOptions = Configuration.GetSection("Spa").Get<SpaOptions>() ?? new SpaOptions();

            var locOptions = app.ApplicationServices.GetService<IOptions<RequestLocalizationOptions>>();
            app.UseRequestLocalization(locOptions.Value);

            //app.UseDefaultFiles();
            app.UseStaticFiles();

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();

                if (spaOptions.UseWebpackDevMiddleware)
                {
                    var webpackEnvVariables = spaOptions.PreRenderEnabled
                        ? spaOptions.PreRenderEnvironmentVariables
                        : spaOptions.EnvironmentVariables;

                    if (spaOptions.HotModuleReplacement)
                    {
                        webpackEnvVariables.Add("hmr", "true");
                    }

                    var webpackEnvDict = new Dictionary<string, string>
                    {
                        {"WEBPACK_ENV", JsonConvert.SerializeObject(webpackEnvVariables)}
                    };

                    app.UseWebpackDevMiddleware(new WebpackDevMiddlewareOptions
                    {
                        ConfigFile = spaOptions.WebpackConfigFile,
                        HotModuleReplacement = spaOptions.HotModuleReplacement,
                        EnvironmentVariables = webpackEnvDict
                    });
                }

                //Adding CSP Response Headers
                //app.Use(async (ctx, next) =>
                //{
                //    ctx.Response.Headers.Add("Content-Security-Policy",
                //        "base-uri 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';script-src 'self' 'unsafe-inline' http://localhost:*  https://localhost:*; default-src 'self' ws://localhost:* http://localhost:*  https://localhost:*; report-uri /api/csp/cspreport");
                //    await next();
                //});

                //DbInitializer.Initialize(context);

                //app.UseSwagger();

                // Enable middleware to serve swagger-ui (HTML, JS, CSS etc.), specifying the Swagger JSON endpoint.
                //app.UseSwaggerUI(c =>
                //{
                //    c.SwaggerEndpoint("/swagger/v1/swagger.json", "My API V1");
                //});

                app.MapWhen(x => !x.Request.Path.Value.StartsWith("/swagger"), builder =>
                {
                    builder.UseMvc(routes =>
                    {
                        routes.MapSpaFallbackRoute(
                            name: "spa-fallback",
                            defaults: new { controller = "Home", action = "Index" });
                    });
                });
            }
            else
            {
                app.UseMvc(routes =>
                {
                    routes.MapRoute(
                        name: "default",
                        template: "{controller=Home}/{action=Index}/{id?}");

                    routes.MapSpaFallbackRoute(
                        name: "spa-fallback",
                        defaults: new { controller = "Home", action = "Index" });
                });

                app.UseExceptionHandler("/Home/Error");


                //Adding CSP Response Headers
                //app.Use(async (ctx, next) =>
                //{
                //    ctx.Response.Headers.Add("Content-Security-Policy",
                //        "default-src 'self'; report-uri /api/csp/cspreport");
                //    await next();
                //});
            }

            // CSRF / XSRF Token
            //app.Use(async (context, next) =>
            //{
            //    if (string.Equals(context.Request.Path.Value, "/", StringComparison.OrdinalIgnoreCase))
            //    {
            //        var tokens = antiforgery.GetAndStoreTokens(context);

            //        context.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken, new CookieOptions()
            //        {
            //            HttpOnly = false
            //        });
            //    }
            //    await next.Invoke();
            //});
        }
    }
}
