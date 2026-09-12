allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    project.buildDir = File(newBuildDir.asFile, project.name)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// --- 👇 كود الإصلاح الذكي 👇 ---
subprojects {
    // تعريف دالة الإصلاح
    fun fixNamespace() {
        if (project.name == "blue_thermal_printer") {
            val android = project.extensions.findByName("android") as? com.android.build.gradle.BaseExtension
            if (android != null && android.namespace == null) {
                android.namespace = "id.kakzaki.blue_thermal_printer"
            }
        }
    }

    // التحقق من حالة المشروع لتجنب الخطأ السابق
    if (project.state.executed) {
        fixNamespace()
    } else {
        project.afterEvaluate {
            fixNamespace()
        }
    }
}
// ----------------------------------

tasks.register<Delete>("clean") {
    delete(rootProject.buildDir)
}