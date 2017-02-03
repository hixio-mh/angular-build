${
    // Usings
    //----------------------------------------------------------------------
    using Typewriter.Extensions.Types;
    using System.Text.RegularExpressions;
    using System.Diagnostics;

    // Configurations
    //----------------------------------------------------------------------
    readonly static  string  ModelClassNamePattern = @"*Models.*Model";
    readonly static  string  ModelInterfaceNamePattern = @"*Models.*";
    readonly static  string  ModelEnumNamePattern = @"*Models.*";
    readonly static  bool RemoveModelSuffix = false;
    readonly static string SharedModelFolderName = "shared";
    readonly static bool CreateAreaFolder  = true;
    readonly static string SubModelFolderNameInArea = "shared";

     // Fields
     //----------------------------------------------------------------------

    readonly static Regex _classNameRegex = new Regex("^"+ ModelClassNamePattern + "$", RegexOptions.Compiled|RegexOptions.Singleline);
    readonly static Regex _interfaceNameRegex = new Regex("^"+ ModelInterfaceNamePattern + "$", RegexOptions.Compiled|RegexOptions.Singleline);
    readonly static Regex _enumNameRegex = new Regex("^"+ ModelEnumNamePattern + "$", RegexOptions.Compiled|RegexOptions.Singleline);

    // Template settings
    //----------------------------------------------------------------------
    Template(Settings settings)
    {
      settings
            .IncludeCurrentProject();
            //.IncludeProject("Project.Name");

        settings.OutputFilenameFactory = file =>        {
           // return "dir/filename.ts";
           //string area = GetAreaName(file);
           //string subArea = GetSubAreaName(file);
           //var modelClass = file.Classes.First();
           //return $"{area}/Client/ts/{GetCamelCase(subArea)}/twModels/{modelClass.name}.ts";
           return $"{GetOutputFileName((Item)file.Classes.FirstOrDefault()??(Item)file.Interfaces.FirstOrDefault()??(Item)file.Enums.FirstOrDefault())}.ts";
        };
    }

    // Debug Info
    //----------------------------------------------------------------------
      static System.Text.StringBuilder _sbDebugInfo = new System.Text.StringBuilder();
      void WriteDebug(string message)
      {
          _sbDebugInfo.AppendLine(message);
      }
     string PrintDebugInfo(Typewriter.CodeModel.File f)
     {
         return $"******************************DEBUG INFO******************************{Environment.NewLine}{Environment.NewLine}{_sbDebugInfo}{Environment.NewLine}******************************DEBUG INFO******************************";
     }

    // Filters
    //----------------------------------------------------------------------
    bool Filter(Class c)
    {
        return _classNameRegex.IsMatch(c.FullName);
    }

    bool Filter(Interface i)
    {
        return _interfaceNameRegex.IsMatch(i.FullName);
    }

    bool Filter(Enum e)
    {
        return _enumNameRegex.IsMatch(e.FullName);
    }
    // Import statements
    //----------------------------------------------------------------------
    IEnumerable<ImportModel> ImportStatementsCore(Item item)
    {
        var importList = new List<ImportModel>();

        var currentPath = GetOutputFileName(item);

        PropertyCollection props = (item as Class)?.Properties??(item as Interface)?.Properties;
        var navigationTypes = props
                .Where(p => (!p.Type.IsPrimitive || p.Type.IsEnum))
                .Select(p=>p.Type)
                .ToList();

         foreach(var t in navigationTypes)
         {
            // TODO:
            var memberName = "{ "+ t.ClassName() + " }";
            var importPath = GetOutputFileName(t);
            var resolvedPath = ResolveRelativePath(currentPath, importPath);
            if(!importList.Any(l=>l.ModuleResolvedPath.Equals(resolvedPath, StringComparison.InvariantCultureIgnoreCase) && l.MemberName == memberName))
            {
                var newImport = new ImportModel(memberName,importPath, resolvedPath);
                importList.Add(newImport);
            }
         }

         var baseClass = (item as Class)?.BaseClass;
         if(baseClass !=null)
         {
            var memberName = "{ " + baseClass.Name + " }";
            var importPath = GetOutputFileName(baseClass);
            var resolvedPath = ResolveRelativePath(currentPath, importPath);
            if(!importList.Any(l=>l.ModuleResolvedPath.Equals(resolvedPath, StringComparison.InvariantCultureIgnoreCase) && l.MemberName == memberName))
            {
                var newImport = new ImportModel(memberName,importPath, resolvedPath);
                importList.Add(newImport);
            }
         }

         var interfaces = (item as Class)?.Interfaces??(item as Interface)?.Interfaces;
         foreach(var i in interfaces)
         {
            var memberName = "{ " + i.Name + " }";
            var importPath = GetOutputFileName(i);
            var resolvedPath = ResolveRelativePath(currentPath, importPath);
            if(!importList.Any(l=>l.ModuleResolvedPath.Equals(resolvedPath, StringComparison.InvariantCultureIgnoreCase) && l.MemberName == memberName))
            {
                var newImport = new ImportModel(memberName,importPath, resolvedPath);
                importList.Add(newImport);
            }
         }

        return importList;
    }

    IEnumerable<ImportModel> Imports(Class c)
    {
        return ImportStatementsCore(c);
    }

    IEnumerable<ImportModel> Imports(Interface i)
    {
     return ImportStatementsCore(i);
    }


    [Typewriter.CodeModel.Attributes.Context("Import", "Imports")]
    public class ImportModel : Item
    {
        public ImportModel(string memberName, string moduleName, string moduleResolvedPath)
        {
            MemberName = memberName;
            ModuleName = moduleName;
            ModuleResolvedPath = moduleResolvedPath;
        }

        public string MemberName{get;set;}
        public string ModuleName{get;set;}
        public string ModuleResolvedPath{get;set;}
        public string StatementText  => $"import { MemberName } from \"{ ModuleResolvedPath }\";";
    }
    // Type names
    //----------------------------------------------------------------------
    string NameWithInheritsCore(Item item)
    {
        var sb = new System.Text.StringBuilder();

        // Append current class/interface name
        sb.Append((item as Class)?.Name??(item as Interface)?.Name);

        // Append base class name
        var baseClass = (item as Class)?.BaseClass;
        if(baseClass!=null)
        {
           sb.Append(" extends " + baseClass.Name);
        }

        // Append interface names
        var interfaces = (item as Class)?.Interfaces??(item as Interface)?.Interfaces;
        if(interfaces?.Count() > 0)
        {
           sb.Append(" implements ");
           for(var i=0;i<interfaces.Count();i++)
           {
              sb.Append(interfaces[i].Name);
              if(i < interfaces.Count - 1)
              {
                sb.Append(", ");
              }
            }
        }

        return sb.ToString();
    }

    string NameWithInherits(Class c)
    {
      return NameWithInheritsCore(c);
    }

    string NameWithInherits(Interface i)
    {
      return NameWithInheritsCore(i);
    }

    // File
    //----------------------------------------------------------------------
    string OriginalFileName(File file)
    {
        var dirInfo = new System.IO.DirectoryInfo(file.FullName);
        var solutionDir = string.Empty;
        while(dirInfo != null && dirInfo.Parent != null){
            dirInfo = dirInfo.Parent;
            if(dirInfo.GetFiles("*.sln", System.IO.SearchOption.TopDirectoryOnly).Any()){
                solutionDir = dirInfo.FullName;
            }
        }
        if(!string.IsNullOrEmpty(solutionDir) && file.FullName.ToLowerInvariant().StartsWith(solutionDir.ToLowerInvariant())){
            return file.FullName.Substring(solutionDir.Length + 1);
        }
        return file.Name;
    }
    // Helpers
    //----------------------------------------------------------------------
    static string GetOutputFileName(Item item)
    {
        var area = string.Empty;

        var ns = (item as Class)?.Namespace??(item as Interface)?.Namespace??(item as Enum)?.Namespace??(item as Type)?.Unwrap().Namespace;
        var typeName = (item as Class)?.Name??(item as Interface)?.Name??(item as Enum)?.Name??(item as Type)?.Unwrap().ClassName();

        if(CreateAreaFolder && !string.IsNullOrEmpty(ns))
        {
            var i = ns.LastIndexOf(".");
            if(i > 0 && i + 1 < ns.Length -1)
            {
                var lastPart = ns.Substring(i+1);
                if(lastPart.ToLowerInvariant() != "models" && lastPart.ToLowerInvariant() != "model" && lastPart.ToLowerInvariant() != "viewmodels" && lastPart.ToLowerInvariant() != "viewmodel" && lastPart.ToLowerInvariant() != "dtos" && lastPart.ToLowerInvariant() != "dto" && lastPart.ToLowerInvariant() != "shared" && lastPart.ToLowerInvariant() != "common")
                {
                    area = ToDashCase(lastPart).ToLowerInvariant();;
                }
            }
        }

        if(RemoveModelSuffix)
        {
            if(typeName.ToLowerInvariant().EndsWith("viewmodel"))
            {
                typeName = typeName.Substring(0,typeName.Length - 7);
            }
            else if(typeName.ToLowerInvariant().EndsWith("model"))
            {
                typeName = typeName.Substring(0,typeName.Length - 5);
            }
            else if(typeName.ToLowerInvariant().EndsWith("dto"))
            {
                typeName = typeName.Substring(0,typeName.Length - 3);
            }
        }
        else
        {    if(typeName.ToLowerInvariant().EndsWith("viewmodel"))
            {
                typeName = typeName.Substring(0,typeName.Length - 7) + ".viewmodel";
            }
            else if(typeName.ToLowerInvariant().EndsWith("model"))
            {
                typeName = typeName.Substring(0,typeName.Length - 5) + ".model";
            }
            else if(typeName.ToLowerInvariant().EndsWith("dto"))
            {
                typeName = typeName.Substring(0,typeName.Length - 3) + ".dto";
            }

        }

        typeName = ToDashCase(typeName).ToLowerInvariant();
        if(CreateAreaFolder && !string.IsNullOrWhiteSpace(area))
        {
            var filePath = area +"/";
            if(!string.IsNullOrWhiteSpace(SubModelFolderNameInArea) && SubModelFolderNameInArea != "." && SubModelFolderNameInArea != "/" && SubModelFolderNameInArea != "\\" && SubModelFolderNameInArea != "./" && SubModelFolderNameInArea != ".\\")
            {
                filePath += SubModelFolderNameInArea + "/";
            }
            return filePath + typeName;
        }
        if(!string.IsNullOrWhiteSpace(SharedModelFolderName) && SharedModelFolderName != "." && SharedModelFolderName != "/" && SharedModelFolderName != "\\" && SharedModelFolderName != "./" && SharedModelFolderName != ".\\")
        {
            return SharedModelFolderName + "/" + typeName;
        }
        return typeName;
    }

    static string ToDashCase(string s)
    {
        if(s == null)
        {
            return string.Empty;
        }
        return string.Concat(s.Select((x,i) => i > 0 && char.IsUpper(x) ? "-" + x.ToString() : x.ToString()));
    }

    static bool IsSamePath(string path1, string path2)
    {
        if(path1 == null || path2 == null)
        {
            return false;
        }

        var lastSlashIndexPath1 = path1.LastIndexOf("/");
        var lastSlashIndexPath2 = path2.LastIndexOf("/");

        if(path1 == path2 || (lastSlashIndexPath1 == -1 && lastSlashIndexPath2 == -1))
        {
            return true;
        }

        if(lastSlashIndexPath1 == -1 || lastSlashIndexPath2 == -1)
        {
            return false;
        }

         var dir1 = path1.Substring(0,lastSlashIndexPath1);
         var dir2 = path1.Substring(0,lastSlashIndexPath2);

        return dir1 == dir2;
    }

    static string ResolveRelativePath(string currentPath, string importPath)
    {
        if(IsSamePath(currentPath, importPath))
        {
            if(importPath.LastIndexOf("/") > 0)
            {
                return "./"+ importPath.Substring(importPath.LastIndexOf("/") + 1);
            }else{
                return "./"+ importPath;
            }
        }
        else
        {
            var currentPathSlashCount = currentPath.Count(c=>c=='/');
            string p = "../";
            for(var i = currentPathSlashCount - 1; i > 0; i--)
            {
                p+="../";
            }
            return p + importPath;
        }
    }
}// Generated by Typewriter (https://github.com/frhagn/Typewriter)
// Original File: $OriginalFileName
$Classes(x=>Filter(x))[$Imports[$StatementText
]
export class $NameWithInherits {$Properties[
  $name: $Type;]
}]$Interfaces(x=>Filter(x))[$Imports[$StatementText
]
export interface $NameWithInherits {$Properties[
  $name: $Type;]
}]
$Enums(x=>Filter(x))[export enum $Name {$Values[
  $Name = $Value][,]
}]