using System.Collections.Generic;

namespace Company.AspNetCoreNgStarter1.Models
{
    public class SpaOptions
    {
        public bool UseWebpackDevMiddleware { get; set; }
        public string WebpackConfigFile { get; set; } = "webpack.config.js";
        public bool HotModuleReplacement { get; set; } = true;
        public IDictionary<string, string> EnvironmentVariables { get; set; } = new Dictionary<string, string>();


        public bool PreRenderEnabled { get; set; }
        public string PreRenderModule { get; set; } = "/dist/main";
        public IDictionary<string, string> PreRenderEnvironmentVariables { get; set; } = new Dictionary<string, string>();
    }
}
