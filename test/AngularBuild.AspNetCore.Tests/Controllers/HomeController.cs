using Microsoft.AspNetCore.Mvc;

namespace AngularBuild.AspNetCore.Tests.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
