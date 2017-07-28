using System.Collections.Generic;

namespace Company.AspNetCoreNgStarter1.Models
{
    public class LocalizationOptions
    {
        public string DefaultLanguage { get; set; }
        public IList<string> AvailableLanguages { get; set; } = new List<string>();
        public bool AutoDetectLanguage { get; set; } = true;
        public bool UseLocalizedRoutes { get; set; } = true;
    }
}
